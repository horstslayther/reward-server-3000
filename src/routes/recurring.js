import express from 'express';
import db from '../db.js';
import { requireRole } from '../auth.js';
import { runRecurringTick } from '../recurring.js';

const router = express.Router();

// Admin: list recurring templates
router.get('/', requireRole('admin'), (req, res) => {
  const rows = db.prepare('SELECT * FROM recurring_tasks ORDER BY id DESC').all();
  res.json(rows);
});

// Admin: create a recurring template
router.post('/', requireRole('admin'), (req, res) => {
  const { title, description = '', credits = 0, frequency = 'daily', startDate } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });
  if (!['daily', 'weekly'].includes(frequency)) return res.status(400).json({ error: 'invalid frequency' });
  const c = Math.max(0, parseInt(credits, 10) || 0);
  // next_run defaults to today if not provided
  const next = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
    ? startDate
    : new Date().toISOString().slice(0, 10);
  const info = db
    .prepare('INSERT INTO recurring_tasks (title, description, credits, frequency, next_run) VALUES (?,?,?,?,?)')
    .run(title, description, c, frequency, next);
  const row = db.prepare('SELECT * FROM recurring_tasks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

// Admin: update recurring template
router.patch('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM recurring_tasks WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const { title, description, credits, frequency, active, next_run } = req.body || {};
  const newTitle = title ?? row.title;
  const newDesc = description ?? row.description;
  const newCredits = credits != null ? Math.max(0, parseInt(credits, 10) || 0) : row.credits;
  const newFreq = frequency ? (['daily','weekly'].includes(frequency) ? frequency : row.frequency) : row.frequency;
  const newActive = active != null ? (active ? 1 : 0) : row.active;
  const newNext = next_run && /^\d{4}-\d{2}-\d{2}$/.test(next_run) ? next_run : row.next_run;
  db.prepare('UPDATE recurring_tasks SET title=?, description=?, credits=?, frequency=?, active=?, next_run=? WHERE id=?')
    .run(newTitle, newDesc, newCredits, newFreq, newActive, newNext, id);
  res.json(db.prepare('SELECT * FROM recurring_tasks WHERE id = ?').get(id));
});

// Admin: delete template
router.delete('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM recurring_tasks WHERE id = ?').run(id);
  res.status(204).end();
});

// Admin: run now (generate task and advance schedule if due)
router.post('/:id/run', requireRole('admin'), (req, res) => {
  // Simple approach: set next_run to today to guarantee a generation, then tick
  const id = Number(req.params.id);
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const row = db.prepare('SELECT * FROM recurring_tasks WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE recurring_tasks SET next_run = ? WHERE id = ?').run(dateStr, id);
  const created = runRecurringTick();
  res.json({ ok: true, created });
});

export default router;

