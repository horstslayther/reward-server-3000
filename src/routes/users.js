import express from 'express';
import db from '../db.js';
import { requireRole } from '../auth.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// List users (admin only)
router.get('/', requireRole('admin'), (req, res) => {
  const rows = db
    .prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC, id DESC')
    .all();
  res.json(rows);
});

// Change role (admin only)
router.patch('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body || {};
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'not found' });
  // Prevent removing the last admin
  if (user.role === 'admin' && role === 'user') {
    const countAdmins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get().c;
    if (countAdmins <= 1) return res.status(400).json({ error: 'cannot demote last admin' });
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  const out = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(id);
  res.json(out);
});

// Reset password (admin only)
router.patch('/:id/password', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const { password } = req.body || {};
  if (!password || String(password).length < 4) return res.status(400).json({ error: 'password too short' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'not found' });
  const hash = bcrypt.hashSync(String(password), 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
  res.json({ ok: true });
});

// Delete user (admin only)
router.delete('/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'not found' });
  // Prevent deleting last admin
  if (user.role === 'admin') {
    const countAdmins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get().c;
    if (countAdmins <= 1) return res.status(400).json({ error: 'cannot delete last admin' });
  }
  // Optional: prevent deleting the current logged-in user to avoid confusion
  if (req.session?.user?.id === id) return res.status(400).json({ error: 'cannot delete yourself' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.status(204).end();
});

export default router;

