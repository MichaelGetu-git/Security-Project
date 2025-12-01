-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    verification_expires TIMESTAMP,
    security_level VARCHAR(20) DEFAULT 'PUBLIC',
    mfa_secret VARCHAR(255),
    mfa_enabled BOOLEAN DEFAULT FALSE,
    failed_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    last_login TIMESTAMP,
    phone_number VARCHAR(20),
    picture VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    permissions JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

-- Default admin user
INSERT INTO users (username, email, password_hash, is_verified, security_level)
VALUES (
    'admin',
    'admin@example.com',
    '$2b$12$Qk1wzE6rQH7SyQSLB2X6leVukbn85p33l7K5B3GUJYB96wWw3ONS.',
    TRUE,
    'CONFIDENTIAL'
)
ON CONFLICT (email) DO NOTHING;

-- Default admin role
INSERT INTO roles (name, permissions, description)
VALUES (
    'Admin',
    '["*"]',
    'Full administrative access'
)
ON CONFLICT (name) DO NOTHING;

-- Default Employee role (for all regular users)
INSERT INTO roles (name, permissions, description)
VALUES (
    'Employee',
    '["documents:read", "documents:create", "documents:share"]',
    'Standard employee with document access'
)
ON CONFLICT (name) DO NOTHING;

-- Assign admin role to admin user
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.email = 'admin@example.com' AND r.name = 'Admin'
ON CONFLICT DO NOTHING;

-- Employees
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    department VARCHAR(100),
    position VARCHAR(100),
    salary DECIMAL(15,2),
    data_classification VARCHAR(20) DEFAULT 'PUBLIC',
    CONSTRAINT employees_user_id_key UNIQUE (user_id)
);

-- Documents for DAC
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_id INTEGER REFERENCES users(id),
    classification VARCHAR(20) DEFAULT 'PUBLIC',
    permissions JSONB,
    department VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS document_permissions (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permission_type VARCHAR(20) DEFAULT 'read',
    granted_by INTEGER REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, user_id, permission_type)
);

-- Document Access Requests (policy exceptions / grants)
CREATE TABLE IF NOT EXISTS document_access_requests (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id),
    resolution_note TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS document_access_requests_pending_uidx
    ON document_access_requests (document_id, user_id)
    WHERE status = 'PENDING';

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    username VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    ip_address VARCHAR(50),
    status VARCHAR(20) DEFAULT 'SUCCESS',
    severity VARCHAR(20) DEFAULT 'INFO',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details JSONB
);

-- Policies (ABAC + RuBAC)
CREATE TABLE IF NOT EXISTS policies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL,
    rules JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0
);

-- Refresh Tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50),
    user_agent VARCHAR(255)
);

-- Role Change Requests
CREATE TABLE IF NOT EXISTS role_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    requested_role VARCHAR(50) NOT NULL,
    justification TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

