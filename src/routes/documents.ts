import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { enforceRBAC } from '../middleware/accessControl';
import { AuthRequest } from '../types';
import {
  listDocuments,
  getDocumentById,
  grantDocumentPermission,
  listDocumentsWithShares,
  listDocumentShares,
  revokeDocumentPermission,
  createDocument,
} from '../models/Document';
import { attachDepartment, evaluateAccess } from '../services/accessControlService';
import { createAuditLog } from '../models/AuditLog';
import { findUserByEmail, findUserById } from '../models/User';

const router = Router();

router.get('/', authenticate, async (req, res: Response) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  await attachDepartment(authReq.user);

  const documents = await listDocuments();
  const allowedDocs: any[] = [];
  const deniedDocs: any[] = [];

  for (const doc of documents) {
    const { allowed, reasons, severity } = await evaluateAccess(doc, authReq.user);
    if (allowed) {
      allowedDocs.push({
        ...doc,
        reasonsDenied: [],
      });
    } else {
      deniedDocs.push({
        id: doc.id,
        name: doc.name,
        reasons,
        severity,
      });
    }
  }

  await createAuditLog({
    user_id: authReq.user.userId,
    username: authReq.user.username,
    action: 'DOCUMENT_LIST',
    resource: 'documents',
    ip_address: req.ip,
    details: { allowed: allowedDocs.length, denied: deniedDocs },
    severity: deniedDocs.length ? 'WARN' : 'INFO',
  });

  // Log access to each document (for permission tracking)
  for (const doc of allowedDocs) {
    await createAuditLog({
      user_id: authReq.user.userId,
      username: authReq.user.username,
      action: 'DOCUMENT_ACCESS',
      resource: `document:${doc.id}`,
      ip_address: req.ip,
      details: { 
        documentId: doc.id,
        documentName: doc.name,
        classification: doc.classification,
        isOwner: doc.owner_id === authReq.user.userId,
      },
      severity: doc.classification === 'CONFIDENTIAL' ? 'WARN' : 'INFO',
    });
  }

  return res.json({ documents: allowedDocs, denied: deniedDocs });
});

router.post('/', authenticate, enforceRBAC('documents:create'), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const { name, classification = 'PUBLIC', department } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Document name is required' });
  }

  // MAC enforcement: Users can only create documents at or below their security level
  const SECURITY_LEVELS: Record<string, number> = { PUBLIC: 1, INTERNAL: 2, CONFIDENTIAL: 3 };
  const userLevel = SECURITY_LEVELS[authReq.user.security_level] || 1;
  const docLevel = SECURITY_LEVELS[classification] || 1;
  
  if (docLevel > userLevel) {
    return res.status(403).json({ 
      error: `Access denied: You cannot create ${classification} documents. Your security level (${authReq.user.security_level}) is insufficient.` 
    });
  }

  const document = await createDocument(name, authReq.user.userId, classification, department);
  await createAuditLog({
    user_id: authReq.user.userId,
    username: authReq.user.username,
    action: 'DOCUMENT_CREATE',
    resource: `document:${document.id}`,
    ip_address: req.ip,
    details: { name, classification, department },
    severity: classification === 'CONFIDENTIAL' ? 'WARN' : 'INFO',
  });

  return res.status(201).json({ document });
});

router.get('/admin', authenticate, enforceRBAC('documents:admin'), async (_req, res: Response) => {
  const documents = await listDocumentsWithShares();
  res.json({ documents });
});

router.post('/:id/share', authenticate, enforceRBAC('documents:share'), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const documentId = Number(req.params.id);
  const { userId, email, permission } = req.body;

  const document = await getDocumentById(documentId);
  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  if (document.owner_id !== authReq.user.userId && !authReq.user.roles.some((role) => role.name === 'Admin')) {
    return res.status(403).json({ error: 'Only owners or Admins can delegate DAC' });
  }

  let targetUserId = userId;
  if (!targetUserId && email) {
    const targetUser = await findUserByEmail(email);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }
    targetUserId = targetUser.id;
  }

  if (!targetUserId) {
    return res.status(400).json({ error: 'userId or email required' });
  }

  // MAC enforcement: Cannot share documents with users who lack sufficient clearance
  const targetUser = await findUserById(targetUserId);
  if (!targetUser) {
    return res.status(404).json({ error: 'Target user not found' });
  }

  const SECURITY_LEVELS: Record<string, number> = { PUBLIC: 1, INTERNAL: 2, CONFIDENTIAL: 3 };
  const targetUserLevel = SECURITY_LEVELS[targetUser.security_level] || 1;
  const docLevel = SECURITY_LEVELS[document.classification] || 1;

  if (targetUserLevel < docLevel) {
    return res.status(403).json({ 
      error: `Access denied: Cannot share ${document.classification} document with user having ${targetUser.security_level} clearance. Target user needs at least ${document.classification} level.` 
    });
  }

  const permissionType = permission || 'read';
  await grantDocumentPermission(documentId, targetUserId, permissionType, authReq.user.userId);
  
  await createAuditLog({
    user_id: authReq.user.userId,
    username: authReq.user.username,
    action: 'DOCUMENT_PERMISSION_GRANTED',
    resource: `document:${documentId}`,
    ip_address: req.ip,
    details: { 
      documentId,
      documentName: document.name,
      documentClassification: document.classification,
      targetUserId,
      targetUsername: targetUser.username,
      targetEmail: targetUser.email,
      permissionType,
      grantedBy: authReq.user.userId,
      grantedByUsername: authReq.user.username,
    },
    severity: permissionType === '*' ? 'CRITICAL' : document.classification === 'CONFIDENTIAL' ? 'WARN' : 'INFO',
  });
  
  return res.status(204).send();
});

router.get('/:id/shares', authenticate, enforceRBAC('documents:share'), async (req, res: Response) => {
  const documentId = Number(req.params.id);
  const shares = await listDocumentShares(documentId);
  res.json({ shares });
});

router.delete('/:id/share/:userId', authenticate, enforceRBAC('documents:share'), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const documentId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const { permission } = req.query as { permission?: string };
  
  const document = await getDocumentById(documentId);
  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const targetUser = await findUserById(userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'Target user not found' });
  }

  await revokeDocumentPermission(documentId, userId, permission);
  
  await createAuditLog({
    user_id: authReq.user.userId,
    username: authReq.user.username,
    action: 'DOCUMENT_PERMISSION_REVOKED',
    resource: `document:${documentId}`,
    ip_address: req.ip,
    details: { 
      documentId, 
      documentName: document.name,
      targetUserId: userId,
      targetUsername: targetUser.username,
      permissionType: permission || 'all',
    },
    severity: 'WARN',
  });
  
  return res.status(204).send();
});

export default router;

