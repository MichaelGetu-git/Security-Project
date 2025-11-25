import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

const rotateTransport = new winston.transports.DailyRotateFile({
  dirname: logDir,
  filename: '%DATE%-app.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    rotateTransport,
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, ...meta }) => `${level}: ${message} ${JSON.stringify(meta)}`),
      ),
    }),
  ],
});

