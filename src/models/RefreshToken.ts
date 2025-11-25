import pool from '../config/database';
import crypto from 'crypto';
import { RefreshToken } from '../types';

export const createRefreshToken = async (
  userId: number,
  ttlHours = 24,
  metadata?: { ip?: string; userAgent?: string },
): Promise<{ token: string; record: RefreshToken }> => {
  const token = crypto.randomBytes(32).toString('hex');
  const token_hash = crypto.createHash('sha256').update(token).digest('hex');
  const expires_at = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const { rows } = await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, token_hash, expires_at, metadata?.ip || null, metadata?.userAgent || null],
  );

  return { token, record: rows[0] };
};

export const findRefreshToken = async (token: string): Promise<RefreshToken | null> => {
  const token_hash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows } = await pool.query(
    `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked = false`,
    [token_hash],
  );
  return rows[0] || null;
};

export const revokeRefreshToken = async (id: number) => {
  await pool.query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [id]);
};

export const listRefreshTokensByUser = async (userId: number): Promise<RefreshToken[]> => {
  const { rows } = await pool.query(
    `SELECT * FROM refresh_tokens WHERE user_id = $1 AND revoked = false ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
};

export const revokeRefreshTokensByUserExcept = async (userId: number, keepTokenId?: number) => {
  if (keepTokenId) {
    await pool.query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND id <> $2', [userId, keepTokenId]);
  } else {
    await pool.query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1', [userId]);
  }
};

