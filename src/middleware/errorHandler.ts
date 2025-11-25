import { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('unhandled_error', {
    message: err.message,
    stack: err.stack,
  });
  res.status(500).json({ error: 'Something went wrong!' });
};

