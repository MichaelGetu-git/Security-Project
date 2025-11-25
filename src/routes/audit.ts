import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { enforceRBAC } from '../middleware/accessControl';
import { listRecentAuditLogs, searchAuditLogs } from '../models/AuditLog';

const router = Router();

router.get('/', authenticate, enforceRBAC('audit:read'), async (req, res: Response) => {
  const { user, action, from, to, limit } = req.query as {
    user?: string;
    action?: string;
    from?: string;
    to?: string;
    limit?: string;
  };

  if (!user && !action && !from && !to) {
    const logs = await listRecentAuditLogs(limit ? Number(limit) : 50);
    return res.json({ logs });
  }

  const logs = await searchAuditLogs({
    user,
    action,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    limit: limit ? Number(limit) : 200,
  });
  return res.json({ logs });
});

// Get permission-related logs (document sharing, role changes, etc.)
router.get('/permissions', authenticate, enforceRBAC('audit:read'), async (req, res: Response) => {
  const { resource, from, to, limit } = req.query as {
    resource?: string;
    from?: string;
    to?: string;
    limit?: string;
  };

  const permissionActions = [
    'DOCUMENT_PERMISSION_GRANTED',
    'DOCUMENT_PERMISSION_REVOKED',
    'DOCUMENT_SHARE',
    'DOCUMENT_ACCESS',
    'ROLE_ASSIGNED',
    'ROLE_REMOVED',
    'ROLE_CREATED',
    'SECURITY_LEVEL_CHANGED',
    'SECURITY_LEVEL_REQUEST_CREATED',
    'SECURITY_LEVEL_REQUEST_APPROVED',
    'SECURITY_LEVEL_REQUEST_REJECTED',
  ];

  const searchParams: Parameters<typeof searchAuditLogs>[0] = {
    action: permissionActions.join(','),
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    limit: limit ? Number(limit) : 200,
  };
  
  if (resource) {
    searchParams.resource = `%${resource}%`;
  }
  
  const logs = await searchAuditLogs(searchParams);
  
  return res.json({ logs });
});

export default router;

