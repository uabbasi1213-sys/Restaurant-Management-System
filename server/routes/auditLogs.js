import { Router } from 'express';
import db from '../database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  if (req.user.role_name !== 'Super Admin') {
    return res.status(403).json({ error: 'Only Super Admin can view audit logs' });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get().count;
  const logs = db.prepare(
    'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);

  res.json({ logs, total, page, pages: Math.ceil(total / limit) });
});

export default router;
