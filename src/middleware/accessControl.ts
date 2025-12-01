import { Response, NextFunction } from 'express';
import { AuthRequest, SecurityLevel, Role, Document, PolicyRule } from '../types';

const SECURITY_LEVELS: Record<SecurityLevel, number> = {
  PUBLIC: 1,
  INTERNAL: 2,
  CONFIDENTIAL: 3,
};

export const checkMAC = (userLevel: SecurityLevel, dataLevel: SecurityLevel): boolean => {
  return SECURITY_LEVELS[userLevel] >= SECURITY_LEVELS[dataLevel];
};

export const checkRBAC = (userRoles: Role[], requiredPermission: string): boolean => {
  return userRoles.some(
    (role) => role.permissions.includes('*') || role.permissions.includes(requiredPermission),
  );
};

export const checkDAC = (document: Document, userId: number, action: string): boolean => {
  if (document.owner_id === userId) return true;
  const userPermissions = document.permissions[userId];
  return userPermissions ? userPermissions.includes(action) : false;
};

export const checkRuBAC = (rules: PolicyRule): boolean => {
  const currentHour = new Date().getHours();
  if (rules.timeRestriction && rules.workingHours) {
    const { start, end } = rules.workingHours;
    if (currentHour < start || currentHour > end) {
      return false;
    }
  }
  return true;
};

export const checkABAC = (
  userDepartment: string | null,
  userRole: string,
  resourceDepartment: string,
  requiredRole: string | null,
  _currentTime: Date, // Reserved for future time-based ABAC checks
): boolean => {
  if (!resourceDepartment || resourceDepartment === 'UNKNOWN' || resourceDepartment === '') {
    return true;
  }

  if (!userDepartment || userDepartment === 'UNKNOWN') {
    return false;
  }

  if (userDepartment === resourceDepartment) {
    if (requiredRole) {
      return userRole === requiredRole;
    }
    return true;
  }

  return false;
};

export const enforceMAC = (requiredLevel: SecurityLevel) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!checkMAC(req.user.security_level, requiredLevel)) {
      res.status(403).json({ error: 'Access denied: Insufficient security clearance' });
      return;
    }
    next();
  };
};

export const enforceRBAC = (requiredPermission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!checkRBAC(req.user.roles, requiredPermission)) {
      res.status(403).json({ error: 'Access denied: Insufficient permissions' });
      return;
    }
    next();
  };
};

