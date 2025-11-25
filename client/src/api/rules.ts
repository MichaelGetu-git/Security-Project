import api from '../lib/api';

export type PolicyRule = {
  department?: string;
  role?: string;
  timeRestriction?: boolean | string;
  workingHours?: { start: number; end: number };
  blockWeekend?: boolean;
  location?: string;
  approvalRole?: string;
  allowedResources?: string | number[]; // Can be string (legacy) or array of document IDs
  approvalLimitDays?: number;
  [key: string]: any;
};

export type PolicyRecord = {
  id: number;
  name: string;
  type: 'ABAC' | 'RuBAC';
  rules: PolicyRule;
  is_active: boolean;
};

export const fetchPolicies = async () => {
  const { data } = await api.get<{ policies: PolicyRecord[] }>('/rules');
  return data.policies;
};

export const createPolicyRecord = (payload: Omit<PolicyRecord, 'id'>) => api.post('/rules', payload);

export const updatePolicyRecord = (id: number, payload: Partial<PolicyRecord>) => api.put(`/rules/${id}`, payload);

export const deletePolicyRecord = (id: number) => api.delete(`/rules/${id}`);

