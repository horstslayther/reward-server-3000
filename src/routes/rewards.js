import express from 'express';
import db, { getBalance, getReservedForUser, getReservedTotal, getUserSavings } from '../db.js';
import { requireRole } from '../auth.js';
import { notify } from '../notify.js';

const router = express.Router();
const stmtSavingsForReward = db.prepare('SELECT amount FROM reward_savings WHERE user_id = ? AND reward_id = ?');
const stmtUpsertSaving = db.prepare(`
  INSERT INTO reward_savings (user_id, reward_id, amount)
  VALUES (?, ?, ?)
  ON CONFLICT(user_id, reward_id) DO UPDATE SET amount = excluded.amount
`);
const stmtDeleteSaving = db.prepare('DELETE FROM reward_savings WHERE user_id = ? AND reward_id = ?');

router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM rewards WHERE active = 1 ORDER BY created_at DESC, id DESC')
    .all();
  const userId = req.session?.user?.id;
  if (!userId) return res.json(rows);
  const savings = getUserSavings(userId);
  const map = new Map(savings.map((s) => [s.reward_id, s.amount]));
  const enriched = rows.map((row) => ({ ...row, saved: map.get(row.id) || 0 }));
  res.json(enriched);
});

router.post('/', requireRole('admin'), (req, res) => {
  const { title, description = '', cost, one_time = false } = req.body || {};
  if (!title || cost == null) return res.status(400).json({ error: 'title and cost required' });
  const c = Math.max(0, parseInt(cost, 10) || 0);
  const oneTime = one_time ? 1 : 0;
  const info = db
    .prepare('INSERT INTO rewards (title, description, cost, one_time) VALUES (?, ?, ?, ?)')
    .run(title, description, c, oneTime);
  const reward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(info.lastInsertRowid);
  notify(`Neuer Reward: ${reward.title} (Kosten ${reward.cost})`);
  res.status(201).json(reward);
});

router.patch('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const { title, description, cost, active, one_time } = req.body || {};
  const reward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
  if (!reward) return res.status(404).json({ error: 'not found' });
  const newTitle = title ?? reward.title;
  const newDesc = description ?? reward.description;
  const newCost = cost != null ? Math.max(0, parseInt(cost, 10) || 0) : reward.cost;
  const newActive = active != null ? (active ? 1 : 0) : reward.active;
  const newOneTime = one_time != null ? (one_time ? 1 : 0) : reward.one_time;
  db
    .prepare('UPDATE rewards SET title = ?, description = ?, cost = ?, active = ?, one_time = ? WHERE id = ?')
    .run(newTitle, newDesc, newCost, newActive, newOneTime, id);
  res.json(db.prepare('SELECT * FROM rewards WHERE id = ?').get(id));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM rewards WHERE id = ?').run(id);
  db.prepare('DELETE FROM reward_savings WHERE reward_id = ?').run(id);
  res.status(204).end();
});

router.post('/:id/allocate', requireRole('user'), (req, res) => {
  const id = Number(req.params.id);
  const userId = req.session.user.id;
  const reward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
  if (!reward || reward.active !== 1) return res.status(404).json({ error: 'not found' });
  const { amount } = req.body || {};
  let delta = parseInt(amount, 10);
  if (!Number.isFinite(delta) || delta === 0) return res.status(400).json({ error: 'amount must be non-zero integer' });

  const currentRow = stmtSavingsForReward.get(userId, id);
  const currentSaved = currentRow?.amount || 0;
  if (delta < 0 && Math.abs(delta) > currentSaved) {
    return res.status(400).json({ error: 'not enough saved credits' });
  }
  if (delta > 0) {
    if (reward.cost && currentSaved >= reward.cost) {
      return res.status(400).json({ error: 'goal already reached' });
    }
    if (reward.cost) {
      const remainingToGoal = reward.cost - currentSaved;
      if (remainingToGoal <= 0) return res.status(400).json({ error: 'goal already reached' });
      if (delta > remainingToGoal) delta = remainingToGoal;
    }
    const balance = getBalance();
    const globalAvailable = balance - getReservedTotal();
    if (globalAvailable <= 0) {
      return res.status(400).json({ error: 'no free credits available' });
    }
    if (delta > globalAvailable) {
      return res.status(400).json({ error: 'insufficient free credits', available: globalAvailable });
    }
  }

  const newSaved = currentSaved + delta;
  if (newSaved <= 0) {
    stmtDeleteSaving.run(userId, id);
  } else {
    stmtUpsertSaving.run(userId, id, newSaved);
  }
  const reserved = getReservedForUser(userId);
  const balance = getBalance();
  res.json({
    saved: Math.max(newSaved, 0),
    reserved,
    available: Math.max(balance - reserved, 0)
  });
});

router.post('/:id/redeem', requireRole('user'), (req, res) => {
  const id = Number(req.params.id);
  const userId = req.session.user.id;
  const reward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
  if (!reward || reward.active !== 1) return res.status(404).json({ error: 'not found' });
  const savedRow = stmtSavingsForReward.get(userId, id);
  const saved = savedRow?.amount || 0;
  const balance = getBalance();
  const reserved = getReservedForUser(userId);
  const usable = Math.max(balance - reserved + saved, 0);
  if (usable < reward.cost) {
    return res.status(400).json({ error: 'insufficient available credits', available: usable, cost: reward.cost });
  }
  const usedFromSavings = Math.min(saved, reward.cost);
  if (usedFromSavings > 0) {
    const remaining = saved - usedFromSavings;
    if (remaining <= 0) stmtDeleteSaving.run(userId, id);
    else stmtUpsertSaving.run(userId, id, remaining);
  }
  db.prepare('INSERT INTO ledger (amount, reason) VALUES (?, ?)').run(-reward.cost, `Reward "${reward.title}" redeemed`);
  if (reward.one_time) {
    db.prepare('UPDATE rewards SET active = 0 WHERE id = ?').run(id);
  }
  const newBal = getBalance();
  const newReserved = getReservedForUser(userId);
  const newAvailable = Math.max(newBal - newReserved, 0);
  notify(`Reward eingelöst: ${reward.title} -${reward.cost} (Saldo ${newBal})`);
  res.json({ ok: true, balance: newBal, reserved: newReserved, available: newAvailable });
});

export default router;
