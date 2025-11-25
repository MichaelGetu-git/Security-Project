import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticate } from '../middleware/auth';
import { enforceRBAC } from '../middleware/accessControl';

const router = Router();
const logsDir = path.join(process.cwd(), 'logs');

const loadLatestLogFile = () => {
  if (!fs.existsSync(logsDir)) {
    return null;
  }
  const files = fs
    .readdirSync(logsDir)
    .filter((file) => file.endsWith('.log'))
    .map((file) => ({
      file,
      stat: fs.statSync(path.join(logsDir, file)),
    }))
    .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());
  return files[0]?.file ?? null;
};

router.get('/', authenticate, enforceRBAC('systemLogs:read'), async (req, res) => {
  const limit = Number(req.query.limit || 200);
  const file = loadLatestLogFile();
  if (!file) {
    return res.json({ events: [] });
  }
  const filePath = path.join(logsDir, file);
  const content = fs.readFileSync(filePath, 'utf-8').trim();
  const lines = content.split('\n').filter(Boolean);
  const recent = lines.slice(-limit);
  const events = recent
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    })
    .reverse();
  return res.json({ events });
});

export default router;

