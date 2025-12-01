import { listDocumentPermissions } from '../models/Document';
import { listActivePolicies } from '../models/Policy';
import { getEmployeeByUserId } from '../models/Employee';
import { Document as DocumentModel, AuthRequest } from '../types';
import { checkMAC, checkRBAC } from '../middleware/accessControl';
import { PolicyEngine } from './policyEngine';
import { hasApprovedAccessRequest } from '../models/DocumentAccessRequest';

export const evaluateAccess = async (
  document: DocumentModel,
  reqUser: NonNullable<AuthRequest['user']>,
): Promise<{ allowed: boolean; reasons: string[]; severity: 'INFO' | 'WARN' | 'CRITICAL' }> => {
  const reasons: string[] = [];

  const rbacAllowed = checkRBAC(reqUser.roles, 'documents:read');
  if (!rbacAllowed) {
    reasons.push('RBAC: missing documents:read');
  }

  const permissions = await listDocumentPermissions(document.id);

  const hasApprovedRequest = await hasApprovedAccessRequest(reqUser.userId, document.id);

  const hasDirectPermission = permissions.some(
    (perm) => perm.user_id === reqUser.userId && (perm.permission_type === 'read' || perm.permission_type === '*'),
  );

  const hasException = (hasApprovedRequest && hasDirectPermission) || hasDirectPermission;

  let macAllowed = checkMAC(reqUser.security_level, document.classification);
  if (!macAllowed && !hasException) {
    reasons.push('MAC: insufficient clearance');
  } else if (!macAllowed && hasException) {
    macAllowed = true;
  }

  let dacAllowed = false;

  if (document.owner_id === reqUser.userId) {
    dacAllowed = true;
  } else if (permissions.some(
    (perm) => perm.user_id === reqUser.userId && (perm.permission_type === 'read' || perm.permission_type === '*'),
  )) {
    dacAllowed = true;
  } else if (document.classification === 'PUBLIC') {
    dacAllowed = true;
  } else if (document.classification === 'INTERNAL' && macAllowed) {
    dacAllowed = true;
  } else if (document.classification === 'CONFIDENTIAL' && macAllowed) {
    dacAllowed = true;
  }

  if (!dacAllowed) {
    reasons.push('DAC: no discretionary grant');
  }

  const policies = await listActivePolicies();
  const policyEngine = new PolicyEngine(policies);
  const isOwner = document.owner_id === reqUser.userId;

  const isOwnerOrHasDAC = isOwner || dacAllowed || hasException;

  const policyContext = {
    user: {
      id: reqUser.userId,
      security_level: reqUser.security_level,
      username: reqUser.username,
      email: reqUser.email,
    },
    roles: reqUser.roles,
    resource: document,
    action: 'read',
    time: new Date(),
    department: reqUser.department,
    isOwnerOrHasDAC,
    isOwner,
  };

  let rulesAllowed = true;
  if (!hasException) {
    rulesAllowed = policyEngine.evaluate(policyContext);
    if (!rulesAllowed) {
      reasons.push('Policy engine denied (ABAC/RuBAC)');
    }
  }

  let abacAllowed = true;
  const hasDepartmentPolicy = policies.some((p) => p.type === 'ABAC' && p.is_active && p.rules?.department);

  if (hasDepartmentPolicy && document.department && !isOwnerOrHasDAC && !hasException) {
    let documentDepartments: string[] = [];

    if (document.department === 'ALL_DEPARTMENTS') {
      abacAllowed = true;
    } else {
      try {
        const parsed = JSON.parse(document.department);
        if (Array.isArray(parsed)) {
          documentDepartments = parsed;
        } else {
          documentDepartments = [document.department];
        }
      } catch {
        documentDepartments = [document.department];
      }

      const userDepartment = reqUser.department;
      abacAllowed = !userDepartment || documentDepartments.includes(userDepartment);
    }
  }

  if (!abacAllowed) {
    reasons.push('ABAC: attribute mismatch');
  }

  const allowed = macAllowed && rbacAllowed && dacAllowed && rulesAllowed && abacAllowed;
  const severity = allowed ? 'INFO' : reasons.some((reason) => reason.includes('Policy')) ? 'CRITICAL' : 'WARN';
  return { allowed, reasons, severity };
};

export const attachDepartment = async (reqUser: NonNullable<AuthRequest['user']>) => {
  if (reqUser.department) {
    return reqUser;
  }
  const employee = await getEmployeeByUserId(reqUser.userId);
  if (employee) {
    reqUser.department = employee.department;
  }
  return reqUser;
};

