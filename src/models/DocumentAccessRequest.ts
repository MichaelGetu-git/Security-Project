import pool from '../config/database';
import { DocumentAccessRequest } from '../types';

export const findPendingAccessRequest = async (userId: number, documentId: number): Promise<DocumentAccessRequest | null> => {
  const { rows } = await pool.query(
    `SELECT * FROM document_access_requests
     WHERE user_id = $1 AND document_id = $2 AND status = 'PENDING'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, documentId],
  );
  return rows[0] || null;
};

export const createDocumentAccessRequest = async (
  userId: number,
  documentId: number,
  reason?: string,
): Promise<DocumentAccessRequest> => {
  const { rows } = await pool.query(
    `INSERT INTO document_access_requests (document_id, user_id, reason)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [documentId, userId, reason || null],
  );
  return rows[0];
};

export const listDocumentAccessRequests = async (status?: string): Promise<DocumentAccessRequest[]> => {
  const values: any[] = [];
  let where = '';
  if (status) {
    values.push(status);
    where = `WHERE dar.status = $${values.length}`;
  }
  const { rows } = await pool.query(
    `SELECT dar.*,
            d.name AS document_name,
            d.classification AS document_classification,
            u.username AS requester_username,
            u.email AS requester_email,
            resolver.username AS resolver_username
     FROM document_access_requests dar
     LEFT JOIN documents d ON d.id = dar.document_id
     LEFT JOIN users u ON u.id = dar.user_id
     LEFT JOIN users resolver ON resolver.id = dar.resolved_by
     ${where}
     ORDER BY dar.created_at DESC`,
    values,
  );
  return rows;
};

export const listAccessRequestsByUser = async (userId: number): Promise<DocumentAccessRequest[]> => {
  const { rows } = await pool.query(
    `SELECT dar.*,
            d.name AS document_name,
            d.classification AS document_classification
     FROM document_access_requests dar
     LEFT JOIN documents d ON d.id = dar.document_id
     WHERE dar.user_id = $1
     ORDER BY dar.created_at DESC`,
    [userId],
  );
  return rows;
};

export const getAccessRequestById = async (id: number): Promise<DocumentAccessRequest | null> => {
  const { rows } = await pool.query('SELECT * FROM document_access_requests WHERE id = $1', [id]);
  return rows[0] || null;
};

export const resolveAccessRequest = async (
  id: number,
  status: 'APPROVED' | 'REJECTED',
  resolverId: number,
  note?: string,
): Promise<DocumentAccessRequest | null> => {
  const { rows } = await pool.query(
    `UPDATE document_access_requests
     SET status = $2,
         resolved_at = NOW(),
         resolved_by = $3,
         resolution_note = $4
     WHERE id = $1
     RETURNING *`,
    [id, status, resolverId, note || null],
  );
  return rows[0] || null;
};

export const hasApprovedAccessRequest = async (userId: number, documentId: number): Promise<boolean> => {
  const { rows } = await pool.query(
    `SELECT 1
     FROM document_access_requests
     WHERE user_id = $1 AND document_id = $2 AND status = 'APPROVED'
     LIMIT 1`,
    [userId, documentId],
  );
  return rows.length > 0;
};

