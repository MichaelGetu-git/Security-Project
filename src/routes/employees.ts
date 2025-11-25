import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { enforceMAC } from '../middleware/accessControl';
import { AuthRequest } from '../types';
import { listEmployees } from '../models/Employee';
import { createAuditLog } from '../models/AuditLog';

const router = Router();

router.get('/', authenticate, enforceMAC('INTERNAL'), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const employees = await listEmployees();
  await createAuditLog({
    user_id: authReq.user?.userId,
    username: authReq.user?.username,
    action: 'EMPLOYEE_LIST',
    resource: 'employees',
    ip_address: req.ip,
  });
  res.json({ employees, requestedBy: authReq.user?.username });
});

export default router;

