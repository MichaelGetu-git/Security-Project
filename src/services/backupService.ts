import cron from 'node-cron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promises as fsp } from 'fs';
import { logger } from '../config/logger';

const backupDir = path.join(process.cwd(), 'backups');
const schedule = process.env.BACKUP_SCHEDULE || '0 2 * * *';
const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10);

const runPgDump = (filePath: string) =>
  new Promise<void>((resolve, reject) => {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbName = process.env.DB_NAME || 'security_db';
    const dbUser = process.env.DB_USER || 'admin';
    const dbPassword = process.env.DB_PASSWORD || '';

    const dump = spawn(
      'pg_dump',
      ['-h', dbHost, '-p', dbPort, '-U', dbUser, dbName],
      {
        env: {
          ...process.env,
          PGPASSWORD: dbPassword,
        },
      },
    );

    const out = fs.createWriteStream(filePath);
    dump.stdout.pipe(out);

    dump.stderr.on('data', (data) => {
      logger.error('pg_dump_stderr', { data: data.toString() });
    });

    dump.on('error', (error) => reject(error));
    dump.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pg_dump exited with code ${code}`));
      }
    });
  });

const pruneOldBackups = async () => {
  if (retentionDays <= 0) return;
  const files = await fsp.readdir(backupDir).catch(() => []);
  const threshold = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(backupDir, file);
      const stat = await fsp.stat(filePath);
      if (stat.isFile() && stat.mtime.getTime() < threshold) {
        await fsp.unlink(filePath);
        logger.info('backup_deleted', { file });
      }
    }),
  );
};

const executeBackup = async () => {
  try {
    await fsp.mkdir(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dbName = process.env.DB_NAME || 'security_db';
    const filePath = path.join(backupDir, `${dbName}-${timestamp}.sql`);

    await runPgDump(filePath);
    logger.info('backup_created', { file: filePath });
    await pruneOldBackups();
  } catch (error) {
    logger.error('backup_failed', { message: (error as Error).message });
  }
};

export const startBackupScheduler = () => {
  cron.schedule(schedule, executeBackup, {
    timezone: process.env.BACKUP_TIMEZONE || 'UTC',
  });
  logger.info('backup_scheduler_started', { schedule });
};

export const runBackupNow = () => executeBackup();

export const listBackupFiles = async () => {
  await fsp.mkdir(backupDir, { recursive: true });
  const files = await fsp.readdir(backupDir);
  const entries = await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(backupDir, file);
      const stat = await fsp.stat(filePath);
      return {
        name: file,
        path: filePath,
        size: stat.size,
        modified: stat.mtime,
      };
    }),
  );
  return entries.sort((a, b) => b.modified.getTime() - a.modified.getTime());
};

export const getBackupDirectory = () => backupDir;

