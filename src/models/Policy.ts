import pool from '../config/database';
import { Policy } from '../types';

export const listActivePolicies = async (): Promise<Policy[]> => {
  const { rows } = await pool.query('SELECT * FROM policies WHERE is_active = true ORDER BY id ASC');
  return rows;
};

export const listAllPolicies = async (): Promise<Policy[]> => {
  const { rows } = await pool.query('SELECT * FROM policies ORDER BY id ASC');
  return rows;
};

export const createPolicy = async (policy: Omit<Policy, 'id'>): Promise<Policy> => {
  const { rows } = await pool.query(
    `INSERT INTO policies (name, type, rules, is_active)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING *`,
    [policy.name, policy.type, JSON.stringify(policy.rules), policy.is_active],
  );
  return rows[0];
};

export const updatePolicy = async (id: number, data: Partial<Policy>): Promise<Policy | null> => {
  const existing = await pool.query('SELECT * FROM policies WHERE id = $1', [id]);
  if (!existing.rows[0]) {
    return null;
  }
  const merged = {
    ...existing.rows[0],
    ...data,
    rules: data.rules ? JSON.stringify(data.rules) : existing.rows[0].rules,
  };
  const { rows } = await pool.query(
    `UPDATE policies
     SET name = $2, type = $3, rules = $4::jsonb, is_active = $5
     WHERE id = $1
     RETURNING *`,
    [id, merged.name, merged.type, merged.rules, merged.is_active],
  );
  return rows[0];
};

export const deletePolicy = async (id: number) => {
  await pool.query('DELETE FROM policies WHERE id = $1', [id]);
};

