import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'app.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  credits INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  approved_at TEXT,
  deleted_at TEXT,
  recurring_id INTEGER
);

CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  cost INTEGER NOT NULL,
  one_time INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','user')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recurring_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  credits INTEGER NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly')),
  next_run TEXT NOT NULL, -- YYYY-MM-DD (local date)
  last_run TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reward_savings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  reward_id INTEGER NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, reward_id)
);
`);

function ensureRecurringColumn() {
  try {
    const columns = db.prepare('PRAGMA table_info(tasks)').all();
    const hasRecurring = columns.some((c) => c.name === 'recurring_id');
    const hasLegacy = columns.some((c) => c.name === 'recuring_id');
    if (!hasRecurring) {
      if (hasLegacy) {
        db.exec('ALTER TABLE tasks RENAME COLUMN recuring_id TO recurring_id');
      } else {
        db.exec('ALTER TABLE tasks ADD COLUMN recurring_id INTEGER');
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db] Failed to ensure recurring_id column', err);
    throw err;
  }
}

function ensureDeletedAtColumn() {
  try {
    const columns = db.prepare('PRAGMA table_info(tasks)').all();
    const hasDeletedAt = columns.some((c) => c.name === 'deleted_at');
    if (!hasDeletedAt) {
      db.exec('ALTER TABLE tasks ADD COLUMN deleted_at TEXT');
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db] Failed to ensure deleted_at column', err);
    throw err;
  }
}

ensureRecurringColumn();
ensureDeletedAtColumn();

const stmtBalance = db.prepare('SELECT IFNULL(SUM(amount), 0) AS balance FROM ledger');
const stmtReservedForUser = db.prepare('SELECT IFNULL(SUM(amount), 0) AS reserved FROM reward_savings WHERE user_id = ?');
const stmtReservedTotal = db.prepare('SELECT IFNULL(SUM(amount), 0) AS reserved FROM reward_savings');
const stmtUserSavings = db.prepare('SELECT reward_id, amount FROM reward_savings WHERE user_id = ?');

export function getBalance() {
  const row = stmtBalance.get();
  return row.balance;
}

export function getReservedForUser(userId) {
  if (!userId) return 0;
  const row = stmtReservedForUser.get(userId);
  return row?.reserved || 0;
}

export function getReservedTotal() {
  const row = stmtReservedTotal.get();
  return row?.reserved || 0;
}

export function getUserSavings(userId) {
  if (!userId) return [];
  return stmtUserSavings.all(userId);
}

export default db;
