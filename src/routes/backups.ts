import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticate } from '../middleware/auth';
import { enforceRBAC } from '../middleware/accessControl';
import { getBackupDirectory, listBackupFiles, runBackupNow } from '../services/backupService';

const router = Router();

router.get('/', authenticate, enforceRBAC('backups:read'), async (_req, res) => {
  const backups = await listBackupFiles();
  return res.json({
    backups: backups.map((entry) => ({
      name: entry.name,
      size: entry.size,
      modified: entry.modified,
    })),
  });
});

router.post('/', authenticate, enforceRBAC('backups:manage'), async (_req, res) => {
  return runBackupNow()
    .then(() => res.status(202).json({ message: 'Backup started' }))
    .catch((error) => res.status(500).json({ error: error.message }));
});

router.get('/:file/download', authenticate, enforceRBAC('backups:read'), async (req, res) => {
  const filename = req.params.file;
  const dir = getBackupDirectory();
  const filePath = path.join(dir, filename);
  if (!filePath.startsWith(dir)) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  return res.download(filePath);
});

export default router;

