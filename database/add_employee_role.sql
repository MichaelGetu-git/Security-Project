-- Add Employee role if it doesn't exist
INSERT INTO roles (name, permissions, description)
VALUES (
    'Employee',
    '["documents:read", "documents:create", "documents:share"]'::jsonb,
    'Standard employee with document access'
)
ON CONFLICT (name) DO NOTHING;

-- Assign Employee role to all users who don't have any roles
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, (SELECT id FROM roles WHERE name = 'Employee')
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
);


