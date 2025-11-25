import cron from 'node-cron';
import { listRecentAuditLogs } from '../models/AuditLog';
import { logger } from '../config/logger';

export const startAlertScheduler = () => {
  cron.schedule('*/5 * * * *', async () => {
    const logs = await listRecentAuditLogs(100);
    const failedLogins = logs.filter(
      (log) => log.action === 'DOCUMENT_LIST' && log.details?.denied && log.details.denied.length,
    );
    if (failedLogins.length >= 5) {
      logger.warn('alert_many_denied_documents', {
        count: failedLogins.length,
        sample: failedLogins.slice(0, 3),
      });
    }

    const criticalEvents = logs.filter((log) => log.severity === 'CRITICAL');
    if (criticalEvents.length) {
      logger.error('alert_critical_security_event', {
        criticalEvents,
      });
    }
  });
};

