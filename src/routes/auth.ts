import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByVerificationToken,
  markUserVerified,
  updateLastLogin,
  incrementFailedAttempts,
  setLockout,
  resetFailedAttempts,
  updatePassword,
  updateMfaSecret,
  enableMfa,
  updateProfile,
} from '../models/User';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { assignRole, createRole, findRoleByName, getUserRoles } from '../models/Role';
import {
  createRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  listRefreshTokensByUser,
  revokeRefreshTokensByUserExcept,
} from '../models/RefreshToken';
import { createAuditLog } from '../models/AuditLog';
import { createRoleRequest } from '../models/RoleRequest';

const router = Router();
const ACCOUNT_LOCK_THRESHOLD = 5;
const ACCOUNT_LOCK_MINUTES = 15;

const ADMIN_ACCESS_CODE = process.env.ADMIN_ACCESS_CODE;

const getUserAgent = (req: Request) => {
  const ua = req.headers['user-agent'];
  return Array.isArray(ua) ? ua[0] : ua || '';
};

router.post('/register', async (req: Request, res: Response) => {
  const { username, email, password, verificationToken, adminAccessCode } = req.body;

  const passwordCheck = AuthService.validatePassword(password);
  if (!passwordCheck.valid) {
    return res.status(400).json({ error: passwordCheck.message });
  }

  if (!verificationToken || typeof verificationToken !== 'string') {
    return res.status(400).json({ error: 'Missing verification token' });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const password_hash = await AuthService.hashPassword(password);
  const hashedToken = AuthService.hashToken(verificationToken);
  const verification_expires = new Date(Date.now() + 60 * 60 * 1000);
  
  const isAdmin = adminAccessCode && ADMIN_ACCESS_CODE && adminAccessCode === ADMIN_ACCESS_CODE;
  const security_level = isAdmin ? 'CONFIDENTIAL' : 'PUBLIC';
  
  const user = await createUser({ 
    username, 
    email, 
    password_hash, 
    security_level,
    verification_token: hashedToken, 
    verification_expires 
  });

  let elevatedRole: string | null = null;
  if (isAdmin) {
    let adminRole = await findRoleByName('Admin');
    if (!adminRole) {
      adminRole = await createRole('Admin', ['*'], 'Full administrative access');
    }
    await assignRole(user.id, adminRole.id);
    elevatedRole = 'Admin';
  } else {
    let employeeRole = await findRoleByName('Employee');
    if (!employeeRole) {
      employeeRole = await createRole('Employee', ['documents:read', 'documents:create', 'documents:share'], 'Standard employee with document access');
    }
    await assignRole(user.id, employeeRole.id);
  }
  await createAuditLog({
    user_id: user.id,
    username: user.username,
    action: 'REGISTER',
    resource: 'auth',
    ip_address: req.ip,
    details: { email },
  });
  return res
    .status(201)
    .json({
      id: user.id,
      email: user.email,
      message: 'Check your email to verify your account.',
      elevatedRole,
    });
});

router.get('/verify', async (req: Request, res: Response) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing token' });
  }

  const tokenHash = AuthService.hashToken(token);
  const user = await findUserByVerificationToken(tokenHash);
  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  await markUserVerified(user.id);
  await createAuditLog({
    user_id: user.id,
    username: user.username,
    action: 'EMAIL_VERIFIED',
    resource: 'auth',
    ip_address: req.ip,
  });
  return res.json({ message: 'Email verified successfully.' });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password, otp } = req.body;
  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.is_verified) {
    return res.status(403).json({ error: 'Account not verified' });
  }

  if (user.locked_until && user.locked_until > new Date()) {
    return res.status(423).json({ error: 'Account locked. Try again later.' });
  }

  const matches = await AuthService.comparePassword(password, user.password_hash);
  if (!matches) {
    await incrementFailedAttempts(user.id);
    if (user.failed_attempts + 1 >= ACCOUNT_LOCK_THRESHOLD) {
      const lockedUntil = new Date(Date.now() + ACCOUNT_LOCK_MINUTES * 60 * 1000);
      await setLockout(user.id, lockedUntil);
    }
    await createAuditLog({
      user_id: user.id,
      username: user.username,
      action: 'LOGIN_FAILED',
      resource: 'auth',
      ip_address: req.ip,
      status: 'FAILURE',
      severity: 'WARN',
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.mfa_enabled) {
    if (!otp || !user.mfa_secret || !AuthService.verifyMFAToken(user.mfa_secret, otp)) {
      return res.status(403).json({ error: 'MFA required', requiresMfa: true });
    }
  }

  await resetFailedAttempts(user.id);
  await updateLastLogin(user.id);
  const roles = await getUserRoles(user.id);

  const payload = {
    userId: user.id,
    username: user.username,
    security_level: user.security_level,
    roles,
  };

  const accessToken = AuthService.generateAccessToken(payload);
  const { token: refreshToken } = await createRefreshToken(user.id, undefined, { ip: req.ip, userAgent: getUserAgent(req) });

  await createAuditLog({
    user_id: user.id,
    username: user.username,
    action: 'LOGIN_SUCCESS',
    resource: 'auth',
    ip_address: req.ip,
  });

  return res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: roles.map((role) => role.name),
      security_level: user.security_level,
    },
  });
});

router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing refresh token' });
  }

  const tokenRecord = await findRefreshToken(refreshToken);
  if (!tokenRecord || tokenRecord.expires_at < new Date()) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const user = await findUserById(tokenRecord.user_id);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  const roles = await getUserRoles(user.id);
  const payload = {
    userId: user.id,
    username: user.username,
    security_level: user.security_level,
    roles,
  };

  const accessToken = AuthService.generateAccessToken(payload);
  const { token: newRefreshToken } = await createRefreshToken(user.id, undefined, { ip: req.ip, userAgent: getUserAgent(req) });
  await revokeRefreshToken(tokenRecord.id);

  return res.json({ accessToken, refreshToken: newRefreshToken });
});

router.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const tokenRecord = await findRefreshToken(refreshToken);
    if (tokenRecord) {
      await revokeRefreshToken(tokenRecord.id);
    }
  }
  return res.status(204).send();
});

router.get('/me', authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  if (!authReq.user || !authReq.authUser) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  return res.json({
    id: authReq.authUser.id,
    username: authReq.authUser.username,
    email: authReq.authUser.email,
    phone_number: authReq.authUser.phone_number,
    security_level: authReq.authUser.security_level,
    roles: authReq.user.roles.map((role) => role.name),
    mfa_enabled: authReq.authUser.mfa_enabled,
  });
});

router.post('/profile', authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  await updateProfile(authReq.user.userId, req.body);
  return res.status(204).send();
});

router.post('/password/change', authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  if (!authReq.user || !authReq.authUser) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const matches = await AuthService.comparePassword(currentPassword, authReq.authUser.password_hash);
  if (!matches) {
    return res.status(400).json({ error: 'Current password incorrect' });
  }

  const passwordCheck = AuthService.validatePassword(newPassword);
  if (!passwordCheck.valid) {
    return res.status(400).json({ error: passwordCheck.message });
  }

  const hash = await AuthService.hashPassword(newPassword);
  await updatePassword(authReq.user.userId, hash);
  return res.status(204).send();
});

router.post('/role-request', authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  const { role, justification } = req.body;
  if (!role || !justification) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // Validate that the requested security level is valid
  const validLevels = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'];
  if (!validLevels.includes(role)) {
    return res.status(400).json({ error: 'Invalid security level. Must be PUBLIC, INTERNAL, or CONFIDENTIAL' });
  }

  // Users can only request upgrades, not downgrades
  const SECURITY_LEVELS: Record<string, number> = { PUBLIC: 1, INTERNAL: 2, CONFIDENTIAL: 3 };
  const currentLevel = SECURITY_LEVELS[authReq.user.security_level] || 1;
  const requestedLevel = SECURITY_LEVELS[role] || 1;
  
  if (requestedLevel <= currentLevel) {
    return res.status(400).json({ 
      error: `You cannot request a security level that is equal to or lower than your current level (${authReq.user.security_level}). You can only request upgrades.` 
    });
  }

  await createRoleRequest(authReq.user.userId, role, justification);
  
  await createAuditLog({
    user_id: authReq.user.userId,
    username: authReq.user.username,
    action: 'SECURITY_LEVEL_REQUEST_CREATED',
    resource: `user:${authReq.user.userId}`,
    ip_address: req.ip,
    details: { 
      requesterId: authReq.user.userId,
      requesterUsername: authReq.user.username,
      currentLevel: authReq.user.security_level,
      requestedLevel: role,
      justification,
    },
    severity: role === 'CONFIDENTIAL' ? 'WARN' : 'INFO',
  });
  
  return res.status(201).json({ message: 'Security level request submitted' });
});

router.post('/mfa/setup', authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  if (!authReq.user || !authReq.authUser) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const { secret, qrCode } = AuthService.generateMFASecret(authReq.authUser.username);
  await updateMfaSecret(authReq.user.userId, secret);
  return res.json({ secret, qrCode });
});

router.post('/mfa/enable', authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  if (!authReq.user || !authReq.authUser) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const { token } = req.body;
  if (!token || !authReq.authUser.mfa_secret) {
    return res.status(400).json({ error: 'Missing MFA token' });
  }

  if (!AuthService.verifyMFAToken(authReq.authUser.mfa_secret, token)) {
    return res.status(400).json({ error: 'Invalid MFA token' });
  }

  await enableMfa(authReq.user.userId);
  return res.status(204).send();
});

router.get('/sessions', authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  const sessions = await listRefreshTokensByUser(authReq.user.userId);
  return res.json({ sessions });
});

router.delete('/sessions/:id', authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  const sessionId = Number(req.params.id);
  const sessions = await listRefreshTokensByUser(authReq.user.userId);
  const session = sessions.find((token) => token.id === sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  await revokeRefreshToken(sessionId);
  return res.status(204).send();
});

router.post('/sessions/logout-others', authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  const { keepSessionId } = req.body as { keepSessionId?: number };
  await revokeRefreshTokensByUserExcept(authReq.user.userId, keepSessionId);
  return res.status(204).send();
});

export default router;

