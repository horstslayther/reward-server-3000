import express from 'express';
import db from '../db.js';
import { requireRole } from '../auth.js';
import { runRecurringTick } from '../recurring.js';
import { notify } from '../notify.js';

const router = express.Router();

router.get('/', (req, res) => {
  // Generate due recurring tasks before listing
  try { runRecurringTick(); } catch (_) {}
  const { status } = req.query;
  let rows;
  if (status) {
    rows = db
      .prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC, id DESC')
      .all(status);
  } else {
    rows = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC, id DESC').all();
  }
  res.json(rows);
});

router.post('/', requireRole('admin'), (req, res) => {
  const { title, description = '', credits = 0 } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });
  const c = Math.max(0, parseInt(credits, 10) || 0);
  const info = db
    .prepare('INSERT INTO tasks (title, description, credits) VALUES (?, ?, ?)')
    .run(title, description, c);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  notify(`Neue Aufgabe: ${task.title} (${task.credits} Credits)`);
  res.status(201).json(task);
});

router.patch('/:id/complete', requireRole('user'), (req, res) => {
  const id = Number(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'not found' });
  if (task.status !== 'open') return res.status(400).json({ error: 'cannot complete in this status' });
  db.prepare("UPDATE tasks SET status='pending_approval', completed_at = datetime('now') WHERE id = ?").run(id);
  const who = req.session?.user?.username || 'User';
  notify(`Zur Prüfung: ${task.title} (${task.credits}) von ${who}`);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

router.patch('/:id/approve', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'not found' });
  if (task.status !== 'pending_approval') return res.status(400).json({ error: 'task not pending approval' });
  db.prepare("UPDATE tasks SET status='approved', approved_at = datetime('now') WHERE id = ?").run(id);
  db
    .prepare('INSERT INTO ledger (amount, reason) VALUES (?, ?)')
    .run(task.credits, `Task "${task.title}" approved`);
  notify(`Genehmigt: ${task.title} +${task.credits} Credits`);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

router.patch('/:id/reject', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'not found' });
  if (task.status !== 'pending_approval') return res.status(400).json({ error: 'task not pending approval' });
  db.prepare("UPDATE tasks SET status='open', completed_at = NULL WHERE id = ?").run(id);
  notify(`Abgelehnt: ${task.title}`);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.status(204).end();
});

export default router;
