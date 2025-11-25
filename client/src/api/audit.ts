import api from '../lib/api';

export type AuditLogEntry = {
  id: number;
  timestamp: string;
  username: string;
  ip_address: string;
  action: string;
  resource: string;
  status: string;
};

export const fetchAuditLogs = async (params?: { user?: string; action?: string; from?: string; to?: string }) => {
  const { data } = await api.get<{ logs: AuditLogEntry[] }>('/audit', { params });
  return data.logs;
};

