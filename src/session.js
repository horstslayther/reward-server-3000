import './env.js';
import session from 'express-session';
import SQLiteStoreFactory from 'connect-sqlite3';
import path from 'path';
import fs from 'fs';

const SQLiteStore = SQLiteStoreFactory(session);

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export function sessionMiddleware() {
  return session({
    store: new SQLiteStore({ db: 'sessions.db', dir: dataDir }),
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: 'lax'
      // secure: true // aktivieren, wenn HTTPS
    }
  });
}
