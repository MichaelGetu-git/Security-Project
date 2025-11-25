import pool from '../config/database';
import { SecurityLevel, User } from '../types';

export const findUserByEmail = async (email: string): Promise<User | null> => {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
};

export const findUserById = async (id: number): Promise<User | null> => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
};

export const createUser = async (user: Partial<User>): Promise<User> => {
  const {
    username,
    email,
    password_hash,
    security_level = 'PUBLIC',
    verification_token,
    verification_expires,
  } = user;

  const { rows } = await pool.query(
    `INSERT INTO users (username, email, password_hash, security_level, verification_token, verification_expires)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [username, email, password_hash, security_level, verification_token || null, verification_expires || null],
  );

  return rows[0];
};

export type UserDirectoryEntry = {
  id: number;
  username: string;
  email: string;
  security_level: SecurityLevel;
  is_verified: boolean;
  mfa_enabled: boolean;
  last_login: Date | null;
  department: string | null;
  roles: string[];
};

export const listUsersWithDetails = async (): Promise<UserDirectoryEntry[]> => {
  const { rows } = await pool.query(
    `SELECT
       u.id,
       u.username,
       u.email,
       u.security_level,
       u.is_verified,
       u.mfa_enabled,
       u.last_login,
       e.department,
       COALESCE(
         JSON_AGG(r.name) FILTER (WHERE r.id IS NOT NULL),
         '[]'
       ) AS roles
     FROM users u
     LEFT JOIN employees e ON e.user_id = u.id
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     GROUP BY u.id, e.department
     ORDER BY u.id ASC`,
  );
  return rows.map((row) => ({
    ...row,
    roles: row.roles || [],
  }));
};

export const setVerificationToken = async (userId: number, token: string, expires: Date) => {
  await pool.query(
    'UPDATE users SET verification_token = $2, verification_expires = $3 WHERE id = $1',
    [userId, token, expires],
  );
};

export const findUserByVerificationToken = async (tokenHash: string): Promise<User | null> => {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE verification_token = $1 AND verification_expires > NOW()',
    [tokenHash],
  );
  return rows[0] || null;
};

export const markUserVerified = async (userId: number) => {
  await pool.query(
    'UPDATE users SET is_verified = true, verification_token = NULL, verification_expires = NULL WHERE id = $1',
    [userId],
  );
};

export const updateSecurityLevel = async (userId: number, level: SecurityLevel) => {
  await pool.query('UPDATE users SET security_level = $2 WHERE id = $1', [userId, level]);
};

export const updateLastLogin = async (userId: number): Promise<void> => {
  await pool.query('UPDATE users SET last_login = NOW(), failed_attempts = 0, locked_until = NULL WHERE id = $1', [
    userId,
  ]);
};

export const incrementFailedAttempts = async (userId: number) => {
  await pool.query('UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = $1', [userId]);
};

export const resetFailedAttempts = async (userId: number) => {
  await pool.query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [userId]);
};

export const setLockout = async (userId: number, lockedUntil: Date) => {
  await pool.query('UPDATE users SET locked_until = $2 WHERE id = $1', [userId, lockedUntil]);
};

export const updatePassword = async (userId: number, passwordHash: string) => {
  await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, passwordHash]);
};

export const updateMfaSecret = async (userId: number, secret: string) => {
  await pool.query('UPDATE users SET mfa_secret = $2 WHERE id = $1', [userId, secret]);
};

export const enableMfa = async (userId: number) => {
  await pool.query('UPDATE users SET mfa_enabled = true WHERE id = $1', [userId]);
};

export const updateProfile = async (userId: number, data: { username?: string; phone_number?: string; picture?: string }) => {
  await pool.query(
    'UPDATE users SET username = COALESCE($2, username), phone_number = COALESCE($3, phone_number), picture = COALESCE($4, picture) WHERE id = $1',
    [userId, data.username || null, data.phone_number || null, data.picture || null],
  );
};

