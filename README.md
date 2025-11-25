# Security Project

TypeScript-based security demo showcasing in-house authentication plus MAC, DAC, RBAC, RuBAC, and ABAC with Dockerized Postgres backend.

## Quick Start

```bash
npm install
npm run build
npm run dev   # local development
docker-compose up --build  # production-like stack
```

## Structure

- `src/` TypeScript backend (config, models, middleware, routes, services, utils)
- `public/` static assets (HTML/CSS/JS dashboard)
- `database/` schema and migrations
- `Dockerfile` + `docker-compose.yml` containerized deployment

## Environment

Copy `.env.example` to `.env` and configure:

- Database credentials (`DB_*`)
- JWT + refresh secrets
- EmailJS keys (`EMAILJS_*`) and `APP_URL`
- reCAPTCHA keys (optional in dev, required for prod)

## Key Features

- Custom registration/login with captcha, email verification via EmailJS, MFA (TOTP), and refresh tokens
- Mandatory / Discretionary / Role / Rule / Attribute-based access control hooks
- Structured audit logging (Postgres + Winston) with alerting, backups, and rate limiting
- Dockerized Postgres with automatic schema load and bind-mounted backups/logs

## Access Control APIs

- `GET /api/documents` — runs MAC, RBAC, DAC, RuBAC, and ABAC checks and returns only the documents the authenticated user may read. Denied resources include reason strings for debugging.
- `POST /api/documents/:id/share` — applies DAC rules (document owners or Admins can grant `read`/`*` permissions to other users).
- `GET /api/users` — RBAC-protected via `users:read`.
- `GET /api/employees` — MAC-protected requiring `INTERNAL` (or higher) clearance.
- `GET /api/audit` — RBAC-protected (`audit:read`) and returns recent audit logs for monitoring.

Populate the `roles`, `user_roles`, `documents`, `document_permissions`, and `policies` tables with sample data to experience the different controls. Example: assign `documents:read` to a `Manager` role, seed an ABAC policy requiring `department = 'Finance'`, and create a RuBAC policy limiting access to business hours.

## Frontend Auth Flow

1. Configure EmailJS + reCAPTCHA keys if desired, then start the app (`npm run dev` or `docker-compose up --build`).
2. Use the built-in registration form (captcha protected) to create an account; check email for verification link.
3. Login with password (and OTP if enabled). Dashboard shows accessible documents, denied reasons, audit logs, MFA setup, and role-request UI.
4. JWT access tokens authorize API calls; refresh tokens rotate automatically.

## Logging & Alerting

- Request/response metadata is logged via Winston (daily rotation under `logs/`).
- Audit events (MAC/DAC/RBAC decisions, document sharing, etc.) are persisted in Postgres (`audit_logs`).
- A cron-based alert job surfaces repeated denials or critical access events via log warnings/errors.

## Automated Backups

- `BACKUP_SCHEDULE` (cron) and `BACKUP_RETENTION_DAYS` control the pg_dump scheduler.
- Backup files are written to `backups/` (bind mounted in Docker) and old snapshots are pruned automatically.
- Ensure the container has `postgresql-client` installed (already handled in the `Dockerfile`) so pg_dump is available.


