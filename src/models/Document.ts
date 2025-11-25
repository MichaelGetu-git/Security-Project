import pool from '../config/database';
import { Document, DocumentPermission } from '../types';

const baseQuery = `
  SELECT d.*
  FROM documents d
`;

export const listDocuments = async (): Promise<Document[]> => {
  const { rows } = await pool.query(`${baseQuery} ORDER BY d.id ASC`);
  return rows;
};

export const getDocumentById = async (id: number): Promise<Document | null> => {
  const { rows } = await pool.query(`${baseQuery} WHERE d.id = $1`, [id]);
  return rows[0] || null;
};

export const listDocumentPermissions = async (documentId: number): Promise<DocumentPermission[]> => {
  const { rows } = await pool.query('SELECT * FROM document_permissions WHERE document_id = $1', [documentId]);
  return rows;
};

export const grantDocumentPermission = async (
  documentId: number,
  userId: number,
  permissionType: string,
  grantedBy: number,
): Promise<void> => {
  await pool.query(
    `INSERT INTO document_permissions (document_id, user_id, permission_type, granted_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (document_id, user_id, permission_type) DO UPDATE
     SET granted_at = NOW(), granted_by = $4`,
    [documentId, userId, permissionType, grantedBy],
  );
};

export const revokeDocumentPermission = async (documentId: number, userId: number, permissionType?: string) => {
  if (permissionType) {
    await pool.query(
      `DELETE FROM document_permissions WHERE document_id = $1 AND user_id = $2 AND permission_type = $3`,
      [documentId, userId, permissionType],
    );
  } else {
    await pool.query(`DELETE FROM document_permissions WHERE document_id = $1 AND user_id = $2`, [documentId, userId]);
  }
};

export const listDocumentShares = async (documentId: number) => {
  const { rows } = await pool.query(
    `SELECT dp.id, dp.permission_type, dp.granted_at, u.id as user_id, u.email
     FROM document_permissions dp
     LEFT JOIN users u ON u.id = dp.user_id
     WHERE dp.document_id = $1
     ORDER BY dp.granted_at DESC`,
    [documentId],
  );
  return rows;
};

export const listDocumentsWithShares = async () => {
  const { rows } = await pool.query(
    `SELECT d.*, owner.username AS owner_name, owner.email AS owner_email
     FROM documents d
     LEFT JOIN users owner ON owner.id = d.owner_id
     ORDER BY d.id ASC`,
  );

  const documents = await Promise.all(
    rows.map(async (row) => {
      const shares = await listDocumentShares(row.id);
      return {
        ...row,
        owner_name: row.owner_name,
        owner_email: row.owner_email,
        shares,
      };
    }),
  );

  return documents;
};

export const createDocument = async (
  name: string,
  ownerId: number,
  classification: string = 'PUBLIC',
  department?: string,
): Promise<Document> => {
  const { rows } = await pool.query(
    `INSERT INTO documents (name, owner_id, classification, department)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, ownerId, classification, department || null],
  );
  return rows[0];
};

