import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { enforceRBAC } from '../middleware/accessControl';
import { createPolicy, deletePolicy, listAllPolicies, updatePolicy } from '../models/Policy';
import { Policy } from '../types';

const router = Router();

router.get('/', authenticate, enforceRBAC('rules:read'), async (_req, res) => {
  const policies = await listAllPolicies();
  return res.json({ policies });
});

router.post('/', authenticate, enforceRBAC('rules:manage'), async (req, res) => {
  const { name, type, rules, is_active = true } = req.body as Partial<Policy>;
  if (!name || !type || !rules) {
    return res.status(400).json({ error: 'name, type, and rules are required' });
  }
  const policy = await createPolicy({ name, type, rules, is_active });
  return res.status(201).json({ policy });
});

router.put('/:id', authenticate, enforceRBAC('rules:manage'), async (req, res) => {
  const policy = await updatePolicy(Number(req.params.id), req.body);
  if (!policy) {
    return res.status(404).json({ error: 'Policy not found' });
  }
  return res.json({ policy });
});

router.delete('/:id', authenticate, enforceRBAC('rules:manage'), async (req, res) => {
  await deletePolicy(Number(req.params.id));
  return res.status(204).send();
});

export default router;

