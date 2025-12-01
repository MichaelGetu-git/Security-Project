import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { enforceRBAC } from '../middleware/accessControl';
import { AuthRequest, SecurityLevel } from '../types';
import { createAuditLog, listAuditLogsByUser } from '../models/AuditLog';
import { listRoles, assignRole, removeRole, createRole, findRoleById } from '../models/Role';
import { listRoleRequests, resolveRoleRequest } from '../models/RoleRequest';
import { findUserById, listUsersWithDetails, updateSecurityLevel } from '../models/User';
import { upsertEmployeeDepartment } from '../models/Employee';
import pool from '../config/database';

const router = Router();

router.get('/', authenticate, enforceRBAC('users:read'), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const users = await listUsersWithDetails();
  await createAuditLog({
    user_id: authReq.user?.userId,
    username: authReq.user?.username,
    action: 'USER_LIST',
    resource: 'users',
    ip_address: req.ip,
    details: { count: users.length },
  });
  res.json({ users });
});

router.get('/roles', authenticate, enforceRBAC('roles:manage'), async (_req, res: Response) => {
  const roles = await listRoles();
  res.json({ roles });
});

router.get('/departments', authenticate, async (_req, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT department
      FROM employees
      WHERE department IS NOT NULL AND department != ''
      ORDER BY department
    `);
    const departments = result.rows.map(row => row.department);
    res.json({ departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

router.post('/roles', authenticate, enforceRBAC('roles:manage'), async (req, res: Response) => {
  const { name, permissions, description } = req.body;
  if (!name || !permissions || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'name and permissions (array) are required' });
  }
  const authReq = req as AuthRequest;
  const role = await createRole(name, permissions, description);
  await createAuditLog({
    user_id: authReq.user?.userId,
    username: authReq.user?.username,
    action: 'ROLE_CREATED',
    resource: 'roles',
    ip_address: req.ip,
    details: { roleId: role.id, roleName: role.name },
  });
  return res.status(201).json({ role });
});

router.post('/:id/roles', authenticate, enforceRBAC('roles:manage'), async (req, res: Response) => {
  const { roleId } = req.body;
  const userId = Number(req.params.id);
  if (!roleId) {
    return res.status(400).json({ error: 'roleId required' });
  }
  const user = await findUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const authReq = req as AuthRequest;
  const role = await findRoleById(roleId);
  if (!role) {
    return res.status(404).json({ error: 'Role not found' });
  }
  
  await assignRole(userId, roleId);
  await createAuditLog({
    user_id: authReq.user?.userId,
    username: authReq.user?.username,
    action: 'ROLE_ASSIGNED',
    resource: `user:${userId}`,
    ip_address: req.ip,
    details: { 
      userId,
      username: user.username,
      roleId,
      roleName: role.name,
      assignedBy: authReq.user?.userId,
      assignedByUsername: authReq.user?.username,
    },
    severity: role.name === 'Admin' ? 'CRITICAL' : 'INFO',
  });
  return res.status(204).send();
});

router.delete('/:id/roles/:roleId', authenticate, enforceRBAC('roles:manage'), async (req, res: Response) => {
  const userId = Number(req.params.id);
  const roleId = Number(req.params.roleId);
  const authReq = req as AuthRequest;
  
  const user = await findUserById(userId);
  const role = await findRoleById(roleId);
  
  await removeRole(userId, roleId);
  await createAuditLog({
    user_id: authReq.user?.userId,
    username: authReq.user?.username,
    action: 'ROLE_REMOVED',
    resource: `user:${userId}`,
    ip_address: req.ip,
    details: { 
      userId,
      username: user?.username,
      roleId,
      roleName: role?.name,
      removedBy: authReq.user?.userId,
      removedByUsername: authReq.user?.username,
    },
    severity: role?.name === 'Admin' ? 'CRITICAL' : 'INFO',
  });
  return res.status(204).send();
});

router.get('/role-requests', authenticate, enforceRBAC('roles:manage'), async (req, res: Response) => {
  const status = req.query.status as string | undefined;
  const requests = await listRoleRequests(status);
  res.json({ requests });
});

router.post('/role-requests/:id/resolve', authenticate, enforceRBAC('roles:manage'), async (req, res: Response) => {
  const { status } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  const requestId = Number(req.params.id);
  const authReq = req as AuthRequest;
  
  // Get the request details
  const { rows } = await pool.query('SELECT * FROM role_requests WHERE id = $1', [requestId]);
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Request not found' });
  }
  
  const request = rows[0];
  const requester = await findUserById(request.user_id);
  
  // If approved, update the user's security level
  if (status === 'APPROVED') {
    const validLevels = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'];
    if (validLevels.includes(request.requested_role)) {
      const previousLevel = requester?.security_level;
      await updateSecurityLevel(request.user_id, request.requested_role as SecurityLevel);
      
      await createAuditLog({
        user_id: authReq.user?.userId,
        username: authReq.user?.username,
        action: 'SECURITY_LEVEL_REQUEST_APPROVED',
        resource: `user:${request.user_id}`,
        ip_address: req.ip,
        details: { 
          requestId,
          requesterId: request.user_id,
          requesterUsername: requester?.username,
          previousLevel,
          requestedLevel: request.requested_role,
          newLevel: request.requested_role,
          justification: request.justification,
          approvedBy: authReq.user?.userId,
          approvedByUsername: authReq.user?.username,
        },
        severity: request.requested_role === 'CONFIDENTIAL' ? 'CRITICAL' : 'WARN',
      });
    }
  } else {
    // REJECTED
    await createAuditLog({
      user_id: authReq.user?.userId,
      username: authReq.user?.username,
      action: 'SECURITY_LEVEL_REQUEST_REJECTED',
      resource: `user:${request.user_id}`,
      ip_address: req.ip,
      details: { 
        requestId,
        requesterId: request.user_id,
        requesterUsername: requester?.username,
        currentLevel: requester?.security_level,
        requestedLevel: request.requested_role,
        justification: request.justification,
        rejectedBy: authReq.user?.userId,
        rejectedByUsername: authReq.user?.username,
      },
      severity: 'INFO',
    });
  }
  
  await resolveRoleRequest(requestId, status);
  return res.status(204).send();
});

router.put('/:id/security-level', authenticate, enforceRBAC('users:update'), async (req, res: Response) => {
  const userId = Number(req.params.id);
  const { level } = req.body as { level?: SecurityLevel };
  if (!level) {
    return res.status(400).json({ error: 'level is required' });
  }
  
  const authReq = req as AuthRequest;
  const targetUser = await findUserById(userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const previousLevel = targetUser.security_level;
  await updateSecurityLevel(userId, level);
  
  await createAuditLog({
    user_id: authReq.user?.userId,
    username: authReq.user?.username,
    action: 'SECURITY_LEVEL_CHANGED',
    resource: `user:${userId}`,
    ip_address: req.ip,
    details: { 
      userId,
      username: targetUser.username,
      previousLevel,
      newLevel: level,
      changedBy: authReq.user?.userId,
      changedByUsername: authReq.user?.username,
    },
    severity: level === 'CONFIDENTIAL' ? 'CRITICAL' : 'WARN',
  });
  
  return res.status(204).send();
});

router.put('/:id/department', authenticate, enforceRBAC('users:update'), async (req, res: Response) => {
  const userId = Number(req.params.id);
  const { department } = req.body as { department?: string | null };
  try {
    await upsertEmployeeDepartment(userId, department || null);
    await createAuditLog({
      user_id: (req as AuthRequest).user?.userId,
      username: (req as AuthRequest).user?.username,
      action: 'USER_DEPARTMENT_UPDATE',
      resource: `user:${userId}`,
      ip_address: req.ip,
      details: { userId, department: department || null },
    });
    return res.status(204).send();
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update department' });
  }
});

router.get('/:id/audit', authenticate, enforceRBAC('audit:read'), async (req, res: Response) => {
  const userId = Number(req.params.id);
  const logs = await listAuditLogsByUser(userId, 50);
  res.json({ logs });
});

export default router;

