import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export const logRequest = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, originalUrl } = req;
  const ip = req.ip;

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('http_request', {
      method,
      path: originalUrl,
      status: res.statusCode,
      ip,
      duration,
      userAgent: req.get('user-agent'),
    });
  });

  next();
};

