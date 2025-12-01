import express, { Application, Request, Response } from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import employeeRoutes from './routes/employees';
import documentRoutes from './routes/documents';
import auditRoutes from './routes/audit';
import rulesRoutes from './routes/rules';
import backupsRoutes from './routes/backups';
import systemLogsRoutes from './routes/systemLogs';
import { logRequest } from './middleware/audit';
import { errorHandler } from './middleware/errorHandler';
import { startAlertScheduler } from './services/alertService';
import { startBackupScheduler } from './services/backupService';

dotenv.config();

const app: Application = express();

const cspOptions = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://www.google.com', 'https://www.gstatic.com'],
    connectSrc: ["'self'", 'https://api.emailjs.com', 'https://www.google.com', 'https://www.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'https://www.gstatic.com', 'https://www.google.com'],
    styleSrc: ["'self'", "'unsafe-inline'"],
    frameSrc: ["'self'", 'https://www.google.com'],
    fontSrc: ["'self'", 'https://www.gstatic.com', 'data:'],
  },
};

app.use(
  helmet({
    contentSecurityPolicy: cspOptions,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// More permissive rate limiting for development
const limiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 60 * 1000, // 15 min prod, 1 min dev
  max: process.env.NODE_ENV === 'production' ? 1000 : 5000, // 1000 prod, 5000 dev
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use(logRequest);

const sendConfig = (_req: Request, res: Response) => {
  const config = {
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || '',
    appUrl: process.env.APP_URL || '',
    emailJs: {
      serviceId: process.env.EMAILJS_SERVICE_ID || '',
      templateId: process.env.EMAILJS_TEMPLATE_ID || '',
      publicKey: process.env.EMAILJS_PUBLIC_KEY || '',
    },
  };
  res.type('application/javascript').send(`window.__APP_CONFIG__ = ${JSON.stringify(config)};`);
};

// Legacy path used in some setups
app.get('/config.js', sendConfig);
// API-friendly path used by the SPA (works through nginx /api proxy)
app.get('/api/config.js', sendConfig);

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/backups', backupsRoutes);
app.use('/api/system-logs', systemLogsRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

startAlertScheduler();
startBackupScheduler();

