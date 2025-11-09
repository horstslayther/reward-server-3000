import express from 'express';
import { requireRole } from '../auth.js';
import { notifyTest, webhookInfo } from '../notify.js';

const router = express.Router();

router.get('/notify/status', requireRole('admin'), (req, res) => {
  res.json(webhookInfo());
});

router.post('/notify/test', requireRole('admin'), async (req, res) => {
  const result = await notifyTest();
  res.json(result);
});

export default router;
