import db from '../database.js';

export function logAudit(userId, username, action, module, details) {
  db.prepare(
    'INSERT INTO audit_logs (user_id, username, action, module, details) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, username, action, module, details);
}
