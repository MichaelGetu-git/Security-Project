import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { enforceRBAC } from '../middleware/accessControl';
import { AuthRequest } from '../types';
import {
  getDocumentById,
  grantDocumentPermission,
  listDocumentsWithShares,
  listDocumentShares,
  revokeDocumentPermission,
  createDocument,
} from '../models/Document';
import {
  createDocumentAccessRequest,
  findPendingAccessRequest,
  listAccessRequestsByUser,
  listDocumentAccessRequests,
  resolveAccessRequest,
  getAccessRequestById,
} from '../models/DocumentAccessRequest';
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

  const documents = await listDocumentsWithShares();
  const userAccessRequests = await listAccessRequestsByUser(authReq.user.userId);
  const latestRequestByDoc = new Map<number, any>();
  for (const request of userAccessRequests) {
    if (!latestRequestByDoc.has(request.document_id)) {
      latestRequestByDoc.set(request.document_id, request);
    }
  }
  const allowedDocs: any[] = [];
  const deniedDocs: any[] = [];

  for (const doc of documents) {
    const { allowed, reasons, severity } = await evaluateAccess(doc, authReq.user);
    const accessRequest = latestRequestByDoc.get(doc.id);
    const canRequestAccess = !accessRequest || accessRequest.status === 'REJECTED';
    if (allowed) {
      allowedDocs.push({
        ...doc,
        reasonsDenied: [],
        accessRequest: accessRequest
          ? {
              id: accessRequest.id,
              status: accessRequest.status,
              requestedAt: accessRequest.created_at,
              resolvedAt: accessRequest.resolved_at,
            }
          : null,
      });
    } else {
      deniedDocs.push({
        id: doc.id,
        name: doc.name,
        reasons,
        severity,
        accessRequest: accessRequest
          ? {
              id: accessRequest.id,
              status: accessRequest.status,
              requestedAt: accessRequest.created_at,
              resolvedAt: accessRequest.resolved_at,
            }
          : null,
        canRequestAccess,
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

  const { name, classification = 'PUBLIC', visibility = 'all', departments = [] } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Document name is required' });
  }

  // Validate visibility and departments
  if (visibility !== 'all' && visibility !== 'specific') {
    return res.status(400).json({ error: 'Visibility must be "all" or "specific"' });
  }

  if (visibility === 'specific' && (!Array.isArray(departments) || departments.length === 0)) {
    return res.status(400).json({ error: 'At least one department must be selected when visibility is "specific"' });
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

  // Store department data as JSON
  const departmentData = visibility === 'all' ? 'ALL_DEPARTMENTS' : JSON.stringify(departments);
  const document = await createDocument(name, authReq.user.userId, classification, departmentData);
  await createAuditLog({
    user_id: authReq.user.userId,
    username: authReq.user.username,
    action: 'DOCUMENT_CREATE',
    resource: `document:${document.id}`,
    ip_address: req.ip,
    details: { name, classification, visibility, departments: visibility === 'specific' ? departments : null },
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

  // Note: MAC enforcement is not applied to sharing - admins and owners can grant access
  // to documents even to users who normally wouldn't have clearance
  const targetUser = await findUserById(targetUserId);
  if (!targetUser) {
    return res.status(404).json({ error: 'Target user not found' });
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

// User-requested policy exception / access escalation
router.post('/:id/request-access', authenticate, async (req, res: Response) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const documentId = Number(req.params.id);
  const { reason } = req.body || {};

  const document = await getDocumentById(documentId);
  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const existingPending = await findPendingAccessRequest(authReq.user.userId, documentId);
  if (existingPending) {
    return res.status(409).json({ error: 'Request already pending', request: existingPending });
  }

  const requestRecord = await createDocumentAccessRequest(authReq.user.userId, documentId, reason);

  await createAuditLog({
    user_id: authReq.user.userId,
    username: authReq.user.username,
    action: 'DOCUMENT_ACCESS_REQUESTED',
    resource: `document:${documentId}`,
    ip_address: req.ip,
    details: {
      documentId,
      documentName: document.name,
      reason,
      requestId: requestRecord.id,
    },
    severity: 'WARN',
  });

  return res.status(201).json({ request: requestRecord });
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

router.get('/access-requests', authenticate, enforceRBAC('documents:admin'), async (req, res: Response) => {
  const status = req.query.status as string | undefined;
  const requests = await listDocumentAccessRequests(status);
  return res.json({ requests });
});

router.post('/access-requests/:id/resolve', authenticate, enforceRBAC('documents:share'), async (req, res: Response) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const requestId = Number(req.params.id);
  const { status, note, permission } = req.body as { status?: 'APPROVED' | 'REJECTED'; note?: string; permission?: string };
  if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const requestRecord = await getAccessRequestById(requestId);
  if (!requestRecord) {
    return res.status(404).json({ error: 'Access request not found' });
  }
  if (requestRecord.status !== 'PENDING') {
    return res.status(400).json({ error: 'Request already resolved' });
  }

  const document = await getDocumentById(requestRecord.document_id);
  const requester = await findUserById(requestRecord.user_id);
  if (!document || !requester) {
    return res.status(404).json({ error: 'Document or requester not found' });
  }

  if (status === 'APPROVED') {
    const permissionType = permission || 'read';
    await grantDocumentPermission(document.id, requester.id, permissionType, authReq.user.userId);
  }

  const updated = await resolveAccessRequest(requestId, status, authReq.user.userId, note);

  await createAuditLog({
    user_id: authReq.user.userId,
    username: authReq.user.username,
    action: status === 'APPROVED' ? 'DOCUMENT_ACCESS_REQUEST_APPROVED' : 'DOCUMENT_ACCESS_REQUEST_REJECTED',
    resource: `document:${document?.id}`,
    ip_address: req.ip,
    details: {
      requestId,
      documentId: document?.id,
      documentName: document?.name,
      requesterId: requester.id,
      requesterUsername: requester.username,
      status,
      note,
    },
    severity: status === 'APPROVED' ? (document?.classification === 'CONFIDENTIAL' ? 'CRITICAL' : 'WARN') : 'INFO',
  });

  return res.json({ request: updated });
});

export default router;

