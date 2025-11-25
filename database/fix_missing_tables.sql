-- Create document_permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS document_permissions (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permission_type VARCHAR(20) DEFAULT 'read',
    granted_by INTEGER REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, user_id, permission_type)
);

-- Verify the table was created
SELECT 'document_permissions table created successfully' AS status;


