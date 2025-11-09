import '../env.js';
import express from 'express';
import db from '../db.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

function toUserSafe(u) {
  if (!u) return null;
  return { id: u.id, username: u.username, role: u.role };
}

// Seed initial admin if none exists
function ensureAdminSeed() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (row.c === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin';
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
      .run(username, hash, 'admin');
    // eslint-disable-next-line no-console
    console.log(`[seed] Admin erstellt: ${username} / (passwort aus .env)`);
  }
}

ensureAdminSeed();

router.get('/me', (req, res) => {
  if (req.session && req.session.user) return res.json(toUserSafe(req.session.user));
  return res.json({ role: 'unknown' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  req.session.user = toUserSafe(user);
  res.json(req.session.user);
});

router.post('/logout', (req, res) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(() => res.json({ ok: true }));
});

// Admin creates users
router.post('/register', (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { username, password, role = 'user' } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'username already exists' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username, hash, role);
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(user);
});

export default router;
