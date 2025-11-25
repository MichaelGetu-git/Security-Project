import pool from '../config/database';
import { Role } from '../types';

export const getUserRoles = async (userId: number): Promise<Role[]> => {
  const { rows } = await pool.query(
    `SELECT r.*
     FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1`,
    [userId],
  );
  return rows;
};

export const listRoles = async (): Promise<Role[]> => {
  const { rows } = await pool.query('SELECT * FROM roles ORDER BY id ASC');
  return rows;
};

export const assignRole = async (userId: number, roleId: number) => {
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, roleId],
  );
};

export const removeRole = async (userId: number, roleId: number) => {
  await pool.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId]);
};

export const findRoleByName = async (name: string): Promise<Role | null> => {
  const { rows } = await pool.query('SELECT * FROM roles WHERE name = $1', [name]);
  return rows[0] || null;
};

export const findRoleById = async (id: number): Promise<Role | null> => {
  const { rows } = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
  return rows[0] || null;
};

export const createRole = async (name: string, permissions: string[], description?: string): Promise<Role> => {
  const { rows } = await pool.query(
    `INSERT INTO roles (name, permissions, description)
     VALUES ($1, $2::jsonb, $3)
     RETURNING *`,
    [name, JSON.stringify(permissions), description || null],
  );
  return rows[0];
};

