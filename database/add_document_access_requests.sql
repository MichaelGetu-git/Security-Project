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

