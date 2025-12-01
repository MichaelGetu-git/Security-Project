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

export const downloadBackup = async (filename: string) => {
  const response = await api.get(`/backups/${filename}/download`, {
    responseType: 'blob',
  });

  // Create a blob URL and trigger download
  const blob = new Blob([response.data], { type: 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

