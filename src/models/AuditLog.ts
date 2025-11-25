import pool from '../config/database';

export interface AuditLogInput {
  user_id?: number;
  username?: string;
  action: string;
  resource?: string;
  ip_address?: string;
  status?: string;
  details?: Record<string, any>;
  severity?: string;
}

export const createAuditLog = async (log: AuditLogInput) => {
  const { user_id, username, action, resource, ip_address, details, status = 'SUCCESS', severity = 'INFO' } = log;
  await pool.query(
    `INSERT INTO audit_logs (user_id, username, action, resource, ip_address, details, status, severity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [user_id || null, username || null, action, resource || null, ip_address || null, details || {}, status, severity],
  );
};

export const listRecentAuditLogs = async (limit = 50) => {
  const { rows } = await pool.query(
    `SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1`,
    [limit],
  );
  return rows;
};

export const searchAuditLogs = async ({
  user,
  action,
  resource,
  from,
  to,
  limit = 200,
}: {
  user?: string;
  action?: string;
  resource?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}) => {
  const conditions: string[] = [];
  const values: any[] = [];

  if (user) {
    values.push(user);
    conditions.push(`username = $${values.length}`);
  }
  if (action) {
    // Support comma-separated actions (e.g., "ACTION1,ACTION2")
    if (action.includes(',')) {
      const actions = action.split(',').map(a => a.trim());
      const placeholders = actions.map((_, i) => `$${values.length + i + 1}`).join(',');
      values.push(...actions);
      conditions.push(`action = ANY(ARRAY[${placeholders}])`);
    } else {
      values.push(action);
      conditions.push(`action = $${values.length}`);
    }
  }
  if (resource) {
    values.push(resource);
    conditions.push(`resource LIKE $${values.length}`);
  }
  if (from) {
    values.push(from);
    conditions.push(`timestamp >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    conditions.push(`timestamp <= $${values.length}`);
  }
  values.push(limit);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM audit_logs ${where} ORDER BY timestamp DESC LIMIT $${values.length}`,
    values,
  );
  return rows;
};

export const listAuditLogsByUser = async (userId: number, limit = 25) => {
  const { rows } = await pool.query(
    `SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2`,
    [userId, limit],
  );
  return rows;
};

