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

  // Check if user has an approved request AND the corresponding permission still exists
  const hasException = hasApprovedRequest && permissions.some(
    (perm) => perm.user_id === reqUser.userId && (perm.permission_type === 'read' || perm.permission_type === '*'),
  );

  // MAC check - can be bypassed by approved admin access requests that still have permissions
  let macAllowed = checkMAC(reqUser.security_level, document.classification);
  if (!macAllowed && !hasException) {
    reasons.push('MAC: insufficient clearance');
  } else if (!macAllowed && hasException) {
    // MAC bypassed due to approved admin access request with active permission
    macAllowed = true;
  }

  // DAC check:
  // - PUBLIC documents: All authenticated users can access (subject to MAC/RBAC)
  // - INTERNAL documents: INTERNAL and CONFIDENTIAL users can access (if MAC passes)
  // - CONFIDENTIAL documents: CONFIDENTIAL users can access (if MAC passes)
  // - Users can always access documents they own
  // - Users with explicit DAC grants can always access
  let dacAllowed = false;

  // Owner always has access
  if (document.owner_id === reqUser.userId) {
    dacAllowed = true;
  }
  // Explicit DAC grant always works
  else if (permissions.some(
    (perm) => perm.user_id === reqUser.userId && (perm.permission_type === 'read' || perm.permission_type === '*'),
  )) {
    dacAllowed = true;
  }
  // For documents at or below user's security level, allow access (MAC-based DAC)
  else if (document.classification === 'PUBLIC') {
    // PUBLIC documents are accessible to all authenticated users
    dacAllowed = true;
  } else if (document.classification === 'INTERNAL' && macAllowed) {
    // INTERNAL documents: If user has INTERNAL or CONFIDENTIAL clearance (MAC passed), allow access
    dacAllowed = true;
  } else if (document.classification === 'CONFIDENTIAL' && macAllowed) {
    // CONFIDENTIAL documents: If user has CONFIDENTIAL clearance (MAC passed), allow access
    dacAllowed = true;
  }

  if (!dacAllowed) {
    reasons.push('DAC: no discretionary grant');
  }

  const policies = await listActivePolicies();
  const policyEngine = new PolicyEngine(policies);
  const isOwner = document.owner_id === reqUser.userId;

  // Check if user owns document, has DAC permission, or has an approved exception request
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
    // Pass ownership/DAC info so policy engine can be lenient where appropriate
    isOwnerOrHasDAC,
    isOwner,
  };

  // Policy engine evaluation:
  // - If user has an approved exception for this document, bypass policy engine (treat as allowed)
  // - Otherwise, evaluate normally
  let rulesAllowed = true;
  if (!hasException) {
    rulesAllowed = policyEngine.evaluate(policyContext);
    if (!rulesAllowed) {
      reasons.push('Policy engine denied (ABAC/RuBAC)');
    }
  }

  // ABAC check: Only apply if there's an active ABAC policy with department restrictions
  // For documents without department restrictions or when user owns/has DAC access, ABAC should pass
  let abacAllowed = true;
  const hasDepartmentPolicy = policies.some((p) => p.type === 'ABAC' && p.is_active && p.rules?.department);

  if (hasDepartmentPolicy && document.department && !isOwnerOrHasDAC && !hasException) {
    // Handle new department visibility system
    let documentDepartments: string[] = [];

    if (document.department === 'ALL_DEPARTMENTS') {
      // Document is visible to all departments - no ABAC restriction
      abacAllowed = true;
    } else {
      // Try to parse as JSON array of departments
      try {
        const parsed = JSON.parse(document.department);
        if (Array.isArray(parsed)) {
          documentDepartments = parsed;
        } else {
          // Legacy single department string
          documentDepartments = [document.department];
        }
      } catch {
        // Legacy single department string
        documentDepartments = [document.department];
      }

      // Check if user is in one of the allowed departments
      const userDepartment = reqUser.department;
      abacAllowed = !userDepartment || documentDepartments.includes(userDepartment);
    }
  }

  if (!abacAllowed) {
    reasons.push('ABAC: attribute mismatch');
  }

  // Access is allowed if:
  // 1. MAC passes (user has sufficient clearance) - REQUIRED
  // 2. RBAC passes (user has documents:read permission) - REQUIRED
  // 3. DAC passes (user owns document OR has been granted access) - REQUIRED
  // 4. Policy engine allows (RuBAC/ABAC policies) - REQUIRED
  // 5. ABAC allows (only enforced if there's a department policy AND user doesn't own/have DAC) - CONDITIONAL
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

