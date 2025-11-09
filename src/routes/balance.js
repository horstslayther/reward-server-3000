import express from 'express';
import db, { getBalance, getReservedForUser } from '../db.js';
import { requireRole } from '../auth.js';
import { notify } from '../notify.js';

const router = express.Router();

router.get('/balance', (req, res) => {
  const balance = getBalance();
  const userId = req.session?.user?.id;
  const reserved = userId ? getReservedForUser(userId) : 0;
  const available = Math.max(balance - reserved, 0);
  res.json({ balance, reserved, available });
});

router.get('/ledger', (req, res) => {
  const rows = db.prepare('SELECT * FROM ledger ORDER BY created_at DESC, id DESC').all();
  res.json(rows);
});

// Admin: manual adjustment (positive or negative)
router.post('/ledger/adjust', requireRole('admin'), (req, res) => {
  const { amount, reason = 'Adjustment' } = req.body || {};
  const a = parseInt(amount, 10);
  if (isNaN(a) || a === 0) return res.status(400).json({ error: 'amount must be non-zero integer' });
  db.prepare('INSERT INTO ledger (amount, reason) VALUES (?, ?)').run(a, `Adjustment: ${reason}`);
  const newBal = getBalance();
  notify(`Korrektur: ${a >= 0 ? '+' : ''}${a} (${reason}) — Saldo ${newBal}`);
  res.status(201).json({ balance: newBal });
});

// Admin: delete a ledger entry
router.delete('/ledger/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM ledger WHERE id = ?').run(id);
  notify(`Ledger-Eintrag gelöscht: #${id}`);
  res.status(204).end();
});

export default router;
