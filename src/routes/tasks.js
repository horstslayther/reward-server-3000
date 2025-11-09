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
  const includeDeleted = req.session?.user?.role === 'admin';
  let rows;
  if (status) {
    if (status === 'deleted' && !includeDeleted) return res.status(403).json({ error: 'forbidden' });
    const filter = includeDeleted ? '' : " AND status <> 'deleted'";
    rows = db
      .prepare(`SELECT * FROM tasks WHERE status = ?${filter} ORDER BY created_at DESC, id DESC`)
      .all(status);
  } else {
    const filter = includeDeleted ? '' : "WHERE status <> 'deleted'";
    rows = db.prepare(`SELECT * FROM tasks ${filter} ORDER BY created_at DESC, id DESC`).all();
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
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'not found' });
  if (task.status === 'deleted') return res.status(200).json(task);
  db.prepare("UPDATE tasks SET status='deleted', deleted_at = datetime('now') WHERE id = ?").run(id);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  notify(`Archiv: ${task.title} wurde gelöscht`);
  res.json(updated);
});

router.patch('/:id/restore', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'not found' });
  if (task.status !== 'deleted') return res.status(400).json({ error: 'task is not deleted' });
  db.prepare("UPDATE tasks SET status='open', deleted_at = NULL WHERE id = ?").run(id);
  const restored = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  notify(`Task wiederhergestellt: ${restored.title}`);
  res.json(restored);
});

router.delete('/:id/purge', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  notify(`Task endgültig entfernt: ${task.title}`);
  res.status(204).end();
});

export default router;
