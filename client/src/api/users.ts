import api from '../lib/api';

export type DirectoryUser = {
  id: number;
  username: string;
  email: string;
  security_level: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
  is_verified: boolean;
  mfa_enabled: boolean;
  last_login: string | null;
  department: string | null;
  roles: string[];
};

export type Role = {
  id: number;
  name: string;
  permissions: string[];
  description?: string;
};

export type RoleRequest = {
  id: number;
  user_id: number;
  requested_role: string;
  status: string;
  justification: string;
  created_at: string;
};

export const fetchUsers = async () => {
  const { data } = await api.get<{ users: DirectoryUser[] }>('/users');
  return data.users;
};

export const fetchRoles = async () => {
  const { data } = await api.get<{ roles: Role[] }>('/users/roles');
  return data.roles;
};

export const createRole = async (payload: { name: string; permissions: string[]; description?: string }) => {
  const { data } = await api.post<{ role: Role }>('/users/roles', payload);
  return data.role;
};

export const fetchRoleRequests = async () => {
  const { data } = await api.get<{ requests: RoleRequest[] }>('/users/role-requests');
  return data.requests;
};

export const resolveRoleRequest = (id: number, status: 'APPROVED' | 'REJECTED') =>
  api.post(`/users/role-requests/${id}/resolve`, { status });

export const assignRoleToUser = (userId: number, roleId: number) => api.post(`/users/${userId}/roles`, { roleId });

export const removeRoleFromUser = (userId: number, roleId: number) => api.delete(`/users/${userId}/roles/${roleId}`);

export const updateUserSecurityLevel = (userId: number, level: DirectoryUser['security_level']) =>
  api.put(`/users/${userId}/security-level`, { level });

export const updateUserDepartment = (userId: number, department: string | null) =>
  api.put(`/users/${userId}/department`, { department });

export const fetchDepartments = async () => {
  const { data } = await api.get<{ departments: string[] }>('/users/departments');
  return data.departments;
};

export const fetchUserAuditTrail = async (userId: number) => {
  const { data } = await api.get<{ logs: any[] }>(`/users/${userId}/audit`);
  return data.logs;
};

