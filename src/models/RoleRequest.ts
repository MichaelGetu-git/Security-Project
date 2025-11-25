import pool from '../config/database';

export const createRoleRequest = async (userId: number, requestedRole: string, justification: string) => {
  await pool.query(
    `INSERT INTO role_requests (user_id, requested_role, justification)
     VALUES ($1, $2, $3)`,
    [userId, requestedRole, justification],
  );
};

export const listRoleRequests = async (status?: string) => {
  if (status) {
    const { rows } = await pool.query('SELECT * FROM role_requests WHERE status = $1 ORDER BY created_at DESC', [status]);
    return rows;
  }
  const { rows } = await pool.query('SELECT * FROM role_requests ORDER BY created_at DESC');
  return rows;
};

export const resolveRoleRequest = async (id: number, status: 'APPROVED' | 'REJECTED') => {
  await pool.query(
    'UPDATE role_requests SET status = $2, resolved_at = NOW() WHERE id = $1',
    [id, status],
  );
};

