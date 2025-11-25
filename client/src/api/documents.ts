import api from '../lib/api';

export type DocumentShare = {
  id: number;
  user_id: number;
  email: string;
  permission_type: string;
  granted_at: string;
};

export type DocumentRecord = {
  id: number;
  name: string;
  owner_id: number;
  owner_name: string;
  owner_email: string;
  classification: string;
  department: string;
  shares: DocumentShare[];
};

export const fetchAdminDocuments = async () => {
  const { data } = await api.get<{ documents: DocumentRecord[] }>('/documents/admin');
  return data.documents;
};

export const grantDocumentAccess = (documentId: number, payload: { email?: string; userId?: number; permission: string }) =>
  api.post(`/documents/${documentId}/share`, payload);

export const revokeDocumentAccess = (documentId: number, userId: number, permission?: string) =>
  api.delete(`/documents/${documentId}/share/${userId}`, { params: { permission } });

export const createDocument = (payload: { name: string; classification?: string; department?: string }) =>
  api.post<{ document: DocumentRecord }>('/documents', payload);

export const fetchUserDocuments = async () => {
  const { data } = await api.get<{ documents: DocumentRecord[]; denied: any[] }>('/documents');
  return data;
};

