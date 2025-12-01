import { Policy, AccessControlContext } from '../types';

export class PolicyEngine {
  constructor(private policies: Policy[] = []) {}

  register(policy: Policy) {
    this.policies.push(policy);
  }

  evaluate(context: AccessControlContext): boolean {
    return this.policies
      .filter((policy) => policy.is_active)
      .every((policy) => this.evaluatePolicy(policy, context));
  }

  private evaluatePolicy(policy: Policy, context: AccessControlContext): boolean {
    const { resource, time } = context;
    const rules = policy.rules;

    const hasRole = (roleName?: string) => {
      if (!roleName) {
        return false;
      }
      const normalized = roleName.toLowerCase().trim();
      return context.roles.some((role) => role.name.toLowerCase().trim() === normalized);
    };

    // Check if user is Admin - Admins always bypass policy restrictions
    const isAdmin = hasRole('Admin');
    if (isAdmin) {
      return true;
    }

    // ABAC Policy: Department + Allowed Resources
    // Example: "Finance" can access specific salary documents, but "HR" and others cannot.
    // If a policy specifies both department and allowedResources, enforce strict access:
    // - Only users from the specified department can access documents in allowedResources
    // - Users from other departments are BLOCKED from those documents, even if MAC/DAC would normally allow
    // - Owners still keep access to their own documents
    // - If document is NOT in allowedResources, this policy doesn't apply (other policies may still block)
    if (rules.department && rules.allowedResources && resource?.id) {
      const allowedResources = Array.isArray(rules.allowedResources) 
        ? rules.allowedResources 
        : typeof rules.allowedResources === 'string' 
        ? [] // Legacy string format, ignore
        : [];
      
      // If this document is in the allowedResources list
      if (allowedResources.length > 0 && allowedResources.includes(resource.id)) {
        // Only users from the specified department can access.
        // Document owners are always allowed.
        if (!context.department || context.department !== rules.department) {
          if (context.isOwner) {
            // Owner override: allow access
            return true;
          }
          // User is NOT from the allowed department and not owner - DENY access
          return false;
        }
        // User IS from the allowed department - allow access (continue evaluation)
      }
      // If document is not in allowedResources, this policy doesn't restrict it (allow other policies to evaluate)
    }

    // Department-based policies (without allowedResources): Skip if user owns document or has DAC access
    // This allows owners and users with explicit grants to access regardless of department
    if (rules.department && !rules.allowedResources && !context.isOwnerOrHasDAC) {
      // If user has no department, allow access (they can't match, but shouldn't be blocked)
      if (context.department && context.department !== rules.department) {
        return false;
      }
      // If policy requires a department but user has none, allow access
      // (department policies are supplementary, not absolute blocks)
    }

    if (rules.role && !hasRole(rules.role)) {
      return false;
    }

    // Time-based restrictions: Working hours
    // Check if workingHours exists (either with explicit timeRestriction flag or implicitly)
    if (rules.workingHours) {
      const hour = time.getHours();
      const start = rules.workingHours.start;
      const end = rules.workingHours.end;
      
      // Handle working hours: if start <= end (e.g., 9-17), check if hour is outside range
      // If start > end (e.g., 22-6, spanning midnight), check if hour is outside both ranges
      if (start <= end) {
        // Normal case: 9 AM to 5 PM
        if (hour < start || hour >= end) {
          if (rules.approvalRole && hasRole(rules.approvalRole)) {
            // User has approval role, allow access
          } else {
            return false;
          }
        }
      } else {
        // Spans midnight: e.g., 22 (10 PM) to 6 (6 AM)
        // Allowed hours: 22, 23, 0, 1, 2, 3, 4, 5 (but not 6)
        if (hour < start && hour >= end) {
          if (rules.approvalRole && hasRole(rules.approvalRole)) {
            // User has approval role, allow access
          } else {
            return false;
          }
        }
      }
    }

    // Weekend block: Check if it's a weekend (Saturday = 6, Sunday = 0)
    if (rules.blockWeekend) {
      const dayOfWeek = time.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        if (rules.approvalRole && hasRole(rules.approvalRole)) {
          // User has approval role, allow access
        } else {
          return false;
        }
      }
    }

    // Location-based restrictions
    if (rules.location && resource?.location && resource.location !== rules.location) {
      return false;
    }

    return true;
  }
}

