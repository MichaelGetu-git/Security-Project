# Enterprise Security Management System

A comprehensive, production-ready security platform built with TypeScript, featuring advanced access control mechanisms, multi-factor authentication, audit logging, and automated backups. This system demonstrates enterprise-grade security practices with Mandatory Access Control (MAC), Discretionary Access Control (DAC), Role-Based Access Control (RBAC), Rule-Based Access Control (RuBAC), and Attribute-Based Access Control (ABAC).

## 🚀 Quick Start with Docker

The fastest way to get started is using Docker Compose:

```bash
# Clone the repository
git clone <repository-url>
cd security-project

# Start all services
docker compose up --build

# Access the application at http://localhost
```

That's it! The application will be running with all dependencies automatically configured.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [Architecture Overview](#architecture-overview)
- [Security Features](#security-features)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Deployment](#deployment)

## 📋 Prerequisites

### System Requirements
- **Docker**: Version 20.10 or later
- **Docker Compose**: Version 2.0 or later
- **Git**: For cloning the repository
- **At least 4GB RAM** for Docker containers
- **2GB free disk space** for containers and data

### Optional (for development)
- **Node.js**: Version 18 or later
- **npm**: Version 8 or later
- **PostgreSQL client** (for local database access)

## 🛠️ Installation & Setup

### Option 1: Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd security-project
   ```

2. **Start the application**
   ```bash
   # Build and start all services
   docker compose up --build

   # Or run in background
   docker compose up -d --build
   ```

3. **Access the application**
   - Frontend: http://localhost
   - Backend API: http://localhost/api
   - Admin Panel: http://localhost/admin

4. **Default admin account**
   - Email: `admin@security.local`
   - Password: `admin123` (change this immediately!)

### Option 2: Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start PostgreSQL** (using Docker)
   ```bash
   docker run --name postgres-dev -e POSTGRES_PASSWORD=mypassword -e POSTGRES_DB=security_db -p 5432:5432 -d postgres:15-alpine
   ```

4. **Run database migrations**
   ```bash
   npm run db:setup
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## ⚙️ Environment Configuration

Create a `.env` file in the root directory with the following variables:

### Database Configuration
```bash
# PostgreSQL Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=security_db
DB_USER=admin
DB_PASSWORD=secure_password_here

# For Docker Compose (internal networking)
# DB_HOST=db
# DB_USER=admin
# DB_PASSWORD=security123
```

### Security Configuration
```bash
# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-here-minimum-32-chars
REFRESH_TOKEN_SECRET=your-super-secure-refresh-token-secret-here-minimum-32-chars

# Session Configuration
SESSION_TIMEOUT_MINUTES=60
MAX_FAILED_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=30

# Password Policy
MIN_PASSWORD_LENGTH=8
PASSWORD_HISTORY_COUNT=5
```

### External Services (Optional)
```bash
# EmailJS Configuration (for email verification)
EMAILJS_SERVICE_ID=your_emailjs_service_id
EMAILJS_TEMPLATE_ID=your_emailjs_template_id
EMAILJS_PUBLIC_KEY=your_emailjs_public_key
APP_URL=http://localhost

# reCAPTCHA Configuration (for bot protection)
RECAPTCHA_SITE_KEY=your_recaptcha_site_key
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
```

### Backup Configuration
```bash
# Backup Settings
BACKUP_SCHEDULE=0 2 * * *    # Daily at 2 AM
BACKUP_RETENTION_DAYS=30
BACKUP_DIR=./backups
```

### Development vs Production
```bash
NODE_ENV=development  # or 'production'
LOG_LEVEL=info        # or 'debug', 'warn', 'error'
```

## 🏃‍♂️ Running the Application

### Docker Compose Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Rebuild after code changes
docker compose up --build -d

# Clean restart (removes volumes)
docker compose down -v
docker compose up --build -d
```

### Service Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │    │   React App     │    │   Node.js API   │
│   (Port 80)     │◄──►│   (Port 80)     │◄──►│   (Port 3000)   │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────┐
                    │ PostgreSQL DB   │
                    │ (Port 5432)     │
                    └─────────────────┘
```

### Accessing Services

- **Main Application**: http://localhost
- **API Documentation**: http://localhost/api/docs (if Swagger enabled)
- **Database**: localhost:5432 (from host machine)
- **Logs**: Available in `./logs/` directory
- **Backups**: Available in `./backups/` directory

## 🏗️ Architecture Overview

### Backend Architecture

```
src/
├── models/           # Database models and queries
├── routes/           # API route handlers
├── services/         # Business logic and external services
├── middleware/       # Authentication, authorization, validation
├── utils/           # Helper functions and utilities
└── types/           # TypeScript type definitions
```

### Key Components

- **Authentication Service**: JWT tokens, MFA, password hashing
- **Access Control Service**: MAC, DAC, RBAC, RuBAC, ABAC enforcement
- **Audit Service**: Comprehensive logging and monitoring
- **Backup Service**: Automated database backups
- **Email Service**: Verification emails and notifications

### Database Schema

```sql
users              # User accounts and authentication
roles              # Role definitions and permissions
user_roles         # User-role assignments
documents          # Secure documents with classification
document_permissions # DAC permissions for documents
policies           # RuBAC and ABAC policy definitions
audit_logs         # Security event logging
employees          # Extended user profile information
```

## 🔐 Security Features

### Authentication & Authorization

- **JWT-based authentication** with automatic token refresh
- **Multi-Factor Authentication (MFA)** with TOTP
- **Password hashing** with bcrypt and salt rounds
- **Account lockout** after failed attempts
- **Session management** with configurable timeouts

### Access Control Models

#### Mandatory Access Control (MAC)
- **Security levels**: PUBLIC, INTERNAL, CONFIDENTIAL
- **No read-up, no write-down** enforcement
- **Clearance-based access** decisions

#### Discretionary Access Control (DAC)
- **Owner-based permissions** on documents
- **Explicit sharing** with read/write/full access
- **Admin override** capabilities

#### Role-Based Access Control (RBAC)
- **Hierarchical roles** with inheritance
- **Permission-based access** to features
- **Dynamic role assignment** and revocation

#### Rule-Based Access Control (RuBAC)
- **Time-based restrictions** (working hours, weekends)
- **Location-based rules** (IP restrictions)
- **Contextual access** policies

#### Attribute-Based Access Control (ABAC)
- **Department-based access** control
- **User attribute** evaluation
- **Dynamic policy** enforcement

### Audit & Compliance

- **Comprehensive logging** of all security events
- **Real-time monitoring** with alerting
- **Immutable audit trail** in database
- **Automated backups** with retention policies
- **Rate limiting** to prevent abuse

## 📚 API Documentation

### Authentication Endpoints

```bash
# User registration
POST /api/auth/register
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "phone_number": "+1234567890"
}

# User login
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "SecurePass123!",
  "otp": "123456"  // If MFA enabled
}

# Password reset
POST /api/auth/forgot-password
{
  "email": "john@example.com"
}

POST /api/auth/reset-password
{
  "token": "reset_token_here",
  "newPassword": "NewSecurePass123!"
}
```

### Document Management

```bash
# List accessible documents
GET /api/documents

# Create new document
POST /api/documents
{
  "name": "Confidential Report",
  "classification": "CONFIDENTIAL",
  "content": "Document content here..."
}

# Share document
POST /api/documents/{id}/share
{
  "userId": 123,
  "permission": "read"
}
```

### Administrative Functions

```bash
# User management (Admin only)
GET /api/users
POST /api/users/{id}/roles
DELETE /api/users/{id}/roles/{roleId}

# Access policies (Admin only)
GET /api/rules
POST /api/rules
PUT /api/rules/{id}
DELETE /api/rules/{id}

# Audit logs (Admin only)
GET /api/audit
GET /api/audit/export
```

## 💻 Development

### Local Development Setup

1. **Install dependencies**
```bash
npm install
   ```

2. **Set up local database**
   ```bash
   # Using Docker
   docker run --name postgres-dev \
     -e POSTGRES_PASSWORD=mypassword \
     -e POSTGRES_DB=security_db \
     -p 5432:5432 \
     -d postgres:15-alpine
   ```

3. **Run database migrations**
   ```bash
   npm run db:setup
   ```

4. **Start development servers**
   ```bash
   # Backend (with hot reload)
   npm run dev

   # Frontend (separate terminal)
   cd client && npm run dev
   ```

### Available Scripts

```bash
# Backend scripts
npm run build      # Build TypeScript
npm run dev        # Development server with hot reload
npm run start      # Production server
npm run test       # Run tests
npm run lint       # Code linting

# Database scripts
npm run db:setup   # Initialize database
npm run db:migrate # Run migrations
npm run db:seed    # Seed with sample data

# Docker scripts
docker compose up -d              # Start all services
docker compose logs -f            # View logs
docker compose down               # Stop services
docker compose restart app        # Restart backend
```

### Testing

```bash
# Run backend tests
npm test

# Run with coverage
npm run test:coverage

# Integration tests
npm run test:integration
```

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# View database logs
docker logs security_db

# Reset database
docker compose down -v
docker compose up --build db
```

#### Application Won't Start
```bash
# Check environment variables
cat .env

# View application logs
docker compose logs app

# Check if ports are available
netstat -tulpn | grep :3000
```

#### Email Verification Not Working
```bash
# Check EmailJS configuration
echo $EMAILJS_SERVICE_ID

# Verify APP_URL setting
echo $APP_URL

# Check server logs for email errors
docker compose logs app | grep -i email
```

#### Permission Denied Errors
```bash
# Check user roles
docker exec security_app psql -U admin -d security_db -c "SELECT u.username, r.name FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id;"

# Verify JWT token
# Check browser developer tools → Network tab → Request headers
```

#### Backup Failures
```bash
# Check backup directory permissions
ls -la backups/

# View backup logs
docker compose logs app | grep -i backup

# Manual backup test
docker exec security_app pg_dump -U admin security_db > backup.sql
```

### Performance Issues

#### High Memory Usage
```bash
# Monitor container resources
docker stats

# Check Node.js memory usage
docker exec security_app ps aux | grep node

# Adjust Node.js memory limits
export NODE_OPTIONS="--max-old-space-size=1024"
```

#### Slow Database Queries
```bash
# Enable query logging
docker exec security_app psql -U admin -d security_db -c "ALTER DATABASE security_db SET log_statement = 'all';"

# View slow queries
docker compose logs db | grep -i duration
```

### Security Hardening

#### Production Checklist
- [ ] Change default admin password
- [ ] Set strong JWT secrets (minimum 32 characters)
- [ ] Configure HTTPS/TLS certificates
- [ ] Set up firewall rules
- [ ] Enable database SSL connections
- [ ] Configure log rotation and monitoring
- [ ] Set up automated security updates
- [ ] Enable rate limiting and DDoS protection

## 🚀 Deployment

### Production Deployment

1. **Set up production environment**
   ```bash
   export NODE_ENV=production
   export APP_URL=https://yourdomain.com
   ```

2. **Configure reverse proxy** (nginx example)
   ```nginx
   server {
       listen 443 ssl;
       server_name yourdomain.com;

       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;

       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       location /api {
           proxy_pass http://localhost:3000/api;
           # Same headers as above
       }
   }
   ```

3. **Set up SSL certificates**
   ```bash
   # Using Let's Encrypt
   certbot --nginx -d yourdomain.com
   ```

4. **Configure systemd service**
   ```bash
   # Create service file: /etc/systemd/system/security-app.service
   [Unit]
   Description=Security Management System
   After=network.target

   [Service]
   Type=simple
   User=appuser
   WorkingDirectory=/opt/security-app
   ExecStart=/usr/bin/npm start
   Restart=always
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```

### Monitoring & Maintenance

#### Health Checks
```bash
# Application health
curl http://localhost/api/health

# Database connectivity
docker exec security_app pg_isready -U admin -d security_db
```

#### Backup Verification
```bash
# List recent backups
ls -la backups/ | head -10

# Verify backup integrity
docker exec security_app pg_restore --list backup.sql
```

#### Log Analysis
```bash
# View recent errors
tail -f logs/app.log | grep -i error

# Count failed login attempts
docker exec security_app psql -U admin -d security_db -c "SELECT COUNT(*) FROM audit_logs WHERE action = 'LOGIN_FAILED' AND created_at > NOW() - INTERVAL '1 hour';"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting and formatting
- **Pre-commit hooks**: Automated testing and linting
- **Security**: Regular dependency updates and security scans

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- **Documentation**: Check this README first
- **Issues**: Use GitHub Issues for bugs and feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Security**: Report security vulnerabilities privately

## 📊 Project Status

- ✅ **Core Security Features**: MAC, DAC, RBAC, RuBAC, ABAC
- ✅ **Authentication**: JWT, MFA, Email verification
- ✅ **Audit & Compliance**: Comprehensive logging
- ✅ **Automated Backups**: Scheduled database backups
- ✅ **Docker Support**: Production-ready containerization
- ✅ **API Documentation**: RESTful API with proper responses

---

**Built with security-first principles and enterprise-grade architecture.** 🔒✨


