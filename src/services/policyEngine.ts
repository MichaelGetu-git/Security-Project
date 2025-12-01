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

    const isAdmin = hasRole('Admin');
    if (isAdmin) {
      return true;
    }

    if (rules.department && rules.allowedResources && resource?.id) {
      const allowedResources = Array.isArray(rules.allowedResources)
        ? rules.allowedResources
        : typeof rules.allowedResources === 'string'
        ? []
        : [];

      if (allowedResources.length > 0 && allowedResources.includes(resource.id)) {
        if (!context.department || context.department !== rules.department) {
          if (context.isOwner) {
            return true;
          }
          return false;
        }
      }
    }

    if (rules.department && !rules.allowedResources && !context.isOwnerOrHasDAC) {
      if (context.department && context.department !== rules.department) {
        return false;
      }
    }

    if (rules.role && !hasRole(rules.role)) {
      return false;
    }

    if (rules.workingHours) {
      const hour = time.getHours();
      const start = rules.workingHours.start;
      const end = rules.workingHours.end;

      if (start <= end) {
        if (hour < start || hour >= end) {
          if (rules.approvalRole && hasRole(rules.approvalRole)) {
            // User has approval role
          } else {
            return false;
          }
        }
      } else {
        if (hour < start && hour >= end) {
          if (rules.approvalRole && hasRole(rules.approvalRole)) {
            // User has approval role
          } else {
            return false;
          }
        }
      }
    }

    if (rules.blockWeekend) {
      const dayOfWeek = time.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        if (rules.approvalRole && hasRole(rules.approvalRole)) {
          // User has approval role
        } else {
          return false;
        }
      }
    }

    if (rules.location && resource?.location && resource.location !== rules.location) {
      return false;
    }

    return true;
  }
}

