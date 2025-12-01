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

export const createDocument = (payload: { name: string; classification?: string; visibility: 'all' | 'specific'; departments?: string[] }) =>
  api.post<{ document: DocumentRecord }>('/documents', payload);

export type DeniedDocumentRecord = {
  id: number;
  name: string;
  reasons: string[];
  severity: string;
  accessRequest?: {
    id: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    requestedAt: string;
    resolvedAt?: string;
  } | null;
  canRequestAccess?: boolean;
};

export const fetchUserDocuments = async () => {
  const { data } = await api.get<{ documents: DocumentRecord[]; denied: DeniedDocumentRecord[] }>('/documents');
  return data;
};

export type DocumentAccessRequest = {
  id: number;
  document_id: number;
  document_name?: string;
  document_classification?: string;
  user_id: number;
  requester_username?: string;
  requester_email?: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  resolved_at?: string;
  resolver_username?: string;
  resolution_note?: string;
};

export const requestDocumentAccess = (documentId: number, payload: { reason?: string }) =>
  api.post(`/documents/${documentId}/request-access`, payload);

export const fetchDocumentAccessRequests = async (status?: string) => {
  const { data } = await api.get<{ requests: DocumentAccessRequest[] }>('/documents/access-requests', {
    params: { status },
  });
  return data.requests;
};

export const resolveDocumentAccessRequest = (
  requestId: number,
  payload: { status: 'APPROVED' | 'REJECTED'; note?: string; permission?: string },
) => api.post(`/documents/access-requests/${requestId}/resolve`, payload);

