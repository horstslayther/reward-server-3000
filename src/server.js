import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import './db.js';
import { requireAuth } from './auth.js';
import tasksRouter from './routes/tasks.js';
import rewardsRouter from './routes/rewards.js';
import balanceRouter from './routes/balance.js';
import authRouter from './routes/auth.js';
import { sessionMiddleware } from './session.js';
import recurringRouter from './routes/recurring.js';
import notifyRouter from './routes/notify.js';
import usersRouter from './routes/users.js';
import { ensurePngIcons } from './generate-icons.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(sessionMiddleware());

app.get('/health', (req, res) => res.json({ ok: true }));

// Generate PNG icons from SVG (best-effort)
ensurePngIcons();

// Serve static UI first (no auth for assets and index page)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '..', 'public')));

// Auth routes
app.use('/auth', authRouter);
// Back-compat: /me now reflects session
app.get('/me', (req, res) => {
  if (req.session?.user) return res.json({ role: req.session.user.role, username: req.session.user.username });
  return res.json({ role: 'unknown' });
});

// Protect API routes with session auth
app.use(requireAuth);
app.use('/tasks', tasksRouter);
app.use('/rewards', rewardsRouter);
app.use('/recurring', recurringRouter);
app.use('/users', usersRouter);
app.use('/', notifyRouter);
app.use('/', balanceRouter);

app.listen(port, () => {
  console.log(`Reward server listening on http://localhost:${port}`);
});
