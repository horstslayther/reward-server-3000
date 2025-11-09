import db from './db.js';
import { notify } from './notify.js';

const stmtHasOpenRecurring = db.prepare(
  "SELECT 1 FROM tasks WHERE recurring_id = ? AND status IN ('open','pending_approval') LIMIT 1"
);
const stmtInsertRecurringTask = db.prepare(
  'INSERT INTO tasks (title, description, credits, recurring_id) VALUES (?,?,?,?)'
);

function toDateOnlyLocal(d = new Date()) {
  // Return YYYY-MM-DD in local time
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toDateOnlyLocal(dt);
}

export function runRecurringTick() {
  const today = toDateOnlyLocal();
  const rows = db
    .prepare("SELECT * FROM recurring_tasks WHERE active = 1 AND next_run <= ? ORDER BY id")
    .all(today);
  if (!rows.length) return 0;
  let created = 0;
  const createdTitles = [];
  let totalCredits = 0;
  for (const r of rows) {
    if (stmtHasOpenRecurring.get(r.id)) {
      // Skip generating new task until previous one abgeschlossen
      continue;
    }
    let next = r.next_run;
    const step = r.frequency === 'weekly' ? 7 : 1; // default daily
    let generatedForTemplate = false;
    // Generate tasks for all missed periods up to today (inclusive)
    while (next <= today) {
      if (!generatedForTemplate) {
        stmtInsertRecurringTask.run(r.title, r.description || '', r.credits || 0, r.id);
        generatedForTemplate = true;
        created++;
        createdTitles.push(r.title);
        totalCredits += r.credits || 0;
      }
      next = addDays(next, step);
    }
    if (generatedForTemplate) {
      db.prepare('UPDATE recurring_tasks SET last_run = ?, next_run = ? WHERE id = ?')
        .run(today, next, r.id);
    }
  }
  if (created > 0) {
    const preview = createdTitles.slice(0, 5).join(', ');
    const suffix = createdTitles.length > 5 ? ' …' : '';
    const details = preview ? ` - ${preview}${suffix}` : '';
    const creditInfo = totalCredits ? ` (insgesamt ${totalCredits} Credits)` : '';
    notify(`Automatisch erzeugt: ${created} wiederkehrende Aufgabe(n)${creditInfo}${details}`);
  }
  return created;
}
