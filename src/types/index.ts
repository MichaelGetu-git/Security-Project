import { Request } from 'express';

export type SecurityLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  is_verified: boolean;
  verification_token?: string;
  verification_expires?: Date;
  security_level: SecurityLevel;
  mfa_enabled: boolean;
  mfa_secret?: string;
  failed_attempts: number;
  locked_until?: Date;
  last_login?: Date;
  picture?: string;
  phone_number?: string;
  created_at: Date;
}

export interface Role {
  id: number;
  name: string;
  permissions: string[];
  description?: string;
}

export interface Employee {
  id: number;
  user_id: number;
  employee_id: string;
  department: string;
  position: string;
  salary: number;
  hire_date: Date;
  data_classification: SecurityLevel;
}

export interface Document {
  id: number;
  name: string;
  owner_id: number;
  classification: SecurityLevel;
  permissions: Record<number, string[]>;
  created_at: Date;
  department?: string;
}

export interface DocumentPermission {
  id: number;
  document_id: number;
  user_id: number;
  permission_type: string;
  granted_by?: number;
  granted_at: Date;
}

export interface DocumentAccessRequest {
  id: number;
  document_id: number;
  user_id: number;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: Date;
  resolved_at?: Date;
  resolved_by?: number;
  resolution_note?: string;
  document_name?: string;
  document_classification?: string;
  requester_username?: string;
  requester_email?: string;
  resolver_username?: string;
}

export interface PolicyRule {
  department?: string;
  role?: string;
  timeRestriction?: boolean | string;
  workingHours?: { start: number; end: number };
  blockWeekend?: boolean;
  location?: string;
  allowedResources?: string | number[]; // Can be string (legacy) or array of document IDs
  approvalRole?: string;
  approvalLimitDays?: number;
}

export interface Policy {
  id: number;
  name: string;
  type: 'ABAC' | 'RuBAC';
  rules: PolicyRule;
  is_active: boolean;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  username?: string;
  action: string;
  resource?: string;
  ip_address?: string;
  status: 'SUCCESS' | 'FAILURE';
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  details?: Record<string, any>;
  timestamp: Date;
}

export interface RefreshToken {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
  ip_address?: string;
  user_agent?: string;
}

export interface JwtUserPayload {
  userId: number;
  username: string;
  security_level: SecurityLevel;
  roles: Role[];
}

export interface JWTPayload extends JwtUserPayload {
  iat: number;
  exp: number;
}

export type AuthRequest = Request & {
  authUser?: User;
  user?: JwtUserPayload & { email?: string; department?: string };
};

export interface AccessControlContext {
  user: Partial<User> & { security_level: SecurityLevel };
  roles: Role[];
  resource: any;
  action: string;
  time: Date;
  ipAddress?: string;
  department?: string;
  isOwnerOrHasDAC?: boolean; // If true, generic department-based policies should not block access
  isOwner?: boolean; // True if the user is the owner of the resource
}

