import api from '../lib/api';

export type BackupEntry = {
  name: string;
  size: number;
  modified: string;
};

export const fetchBackups = async () => {
  const { data } = await api.get<{ backups: BackupEntry[] }>('/backups');
  return data.backups;
};

export const triggerBackup = () => api.post('/backups');

