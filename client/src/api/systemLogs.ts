import api from '../lib/api';

export type SystemLogEvent = {
  timestamp?: string;
  message?: string;
  level?: string;
  [key: string]: any;
};

export const fetchSystemLogs = async () => {
  const { data } = await api.get<{ events: SystemLogEvent[] }>('/system-logs');
  return data.events;
};

