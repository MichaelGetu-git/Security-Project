import { RequestHandler } from 'express';
import { AuthRequest } from '../types';
import { AuthService } from '../services/authService';
import { findUserById } from '../models/User';
import { getUserRoles } from '../models/Role';

export const authenticate: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' });
    }

    const token = authHeader.split(' ')[1];
    const payload = AuthService.verifyAccessToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await findUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const roles = await getUserRoles(user.id);

    const authReq = req as AuthRequest;
    authReq.authUser = user;
    authReq.user = {
      userId: user.id,
      username: user.username,
      email: user.email,
      roles,
      security_level: user.security_level,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

