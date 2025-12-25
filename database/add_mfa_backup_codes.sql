-- Add backup codes column for MFA recovery
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes JSONB;
