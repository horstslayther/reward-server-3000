import './env.js';

function getUrl() {
  return (process.env.DISCORD_WEBHOOK_URL || '').trim();
}

export function webhookInfo() {
  try {
    const u = getUrl();
    const configured = !!u && /^https?:\/\//i.test(u);
    const host = configured ? new URL(u).host : null;
    return { configured, host };
  } catch {
    return { configured: false, host: null };
  }
}

async function send(payload) {
  const u = getUrl();
  if (!u || !/^https?:\/\//i.test(u)) return { ok: false, status: 0, error: 'Webhook URL missing/invalid' };
  try {
    const res = await fetch(u, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, status: res.status, statusText: res.statusText };
  } catch (e) {
    return { ok: false, status: 0, error: String(e && e.message || e) };
  }
}

export async function notify(content) {
  if (!content) return { ok: false, status: 0, error: 'No content' };
  return send({ content: String(content).slice(0, 1900) });
}

export async function notifyTest() {
  return send({ content: '🔔 Discord Test: Benachrichtigungen sind aktiv.' });
}
