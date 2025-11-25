import pool from '../config/database';

export const listEmployees = async () => {
  const { rows } = await pool.query('SELECT * FROM employees');
  return rows;
};

export const getEmployeeByUserId = async (userId: number) => {
  const { rows } = await pool.query('SELECT * FROM employees WHERE user_id = $1', [userId]);
  return rows[0] || null;
};

export const upsertEmployeeDepartment = async (userId: number, department: string | null) => {
  if (!department) {
    await pool.query('DELETE FROM employees WHERE user_id = $1', [userId]);
    return;
  }
  await pool.query(
    `INSERT INTO employees (user_id, department)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET department = EXCLUDED.department`,
    [userId, department],
  );
};

