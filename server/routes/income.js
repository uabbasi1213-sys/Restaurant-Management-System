import { Router } from 'express';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authenticate);

const TYPES = ['Sales', 'Delivery Charges', 'Tips', 'Catering', 'Other'];

// List income
router.get('/', authorize('income', 'dashboard'), (req, res) => {
  const { date_from, date_to, type } = req.query;
  let sql = 'SELECT i.*, o.order_number FROM income i LEFT JOIN orders o ON i.order_id = o.id WHERE i.restaurant_id = ?';
  const params = [req.user.restaurant_id || 1];

  if (date_from) { sql += ' AND i.date >= ?'; params.push(date_from); }
  if (date_to) { sql += ' AND i.date <= ?'; params.push(date_to); }
  if (type) { sql += ' AND i.type = ?'; params.push(type); }

  sql += ' ORDER BY i.date DESC, i.created_at DESC LIMIT 200';
  res.json(db.prepare(sql).all(...params));
});

// Get types
router.get('/types', (req, res) => {
  res.json(TYPES);
});

// Summary stats
router.get('/summary', authorize('income', 'dashboard'), (req, res) => {
  const restaurantId = req.user.restaurant_id || 1;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const todayTotal = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE restaurant_id = ? AND date = ?')
    .get(restaurantId, today);
  const monthTotal = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE restaurant_id = ? AND date >= ?')
    .get(restaurantId, monthStart);
  const byType = db.prepare('SELECT type, COALESCE(SUM(amount), 0) as total FROM income WHERE restaurant_id = ? AND date >= ? GROUP BY type ORDER BY total DESC')
    .all(restaurantId, monthStart);

  res.json({ today: todayTotal.total, month: monthTotal.total, byType });
});

// Create income
router.post('/', authorize('income', 'pos'), (req, res) => {
  const { date, type, amount, description, order_id } = req.body;
  if (!date || !type || !amount) return res.status(400).json({ error: 'Date, type and amount are required' });
  if (parseFloat(amount) <= 0) return res.status(400).json({ error: 'Amount must be positive' });

  const result = db.prepare(
    'INSERT INTO income (date, type, amount, description, order_id, restaurant_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(date, type, parseFloat(amount), description || null, order_id || null, req.user.restaurant_id || 1);

  logAudit(req.user.id, req.user.username, 'ADD', 'Income', `Income Rs.${parseFloat(amount).toFixed(2)} — ${type}`);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Income recorded' });
});

// Update income
router.put('/:id', authorize('income'), (req, res) => {
  const { date, type, amount, description } = req.body;
  if (!date || !type || !amount) return res.status(400).json({ error: 'Date, type and amount are required' });

  const income = db.prepare('SELECT * FROM income WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!income) return res.status(404).json({ error: 'Income not found' });

  db.prepare('UPDATE income SET date = ?, type = ?, amount = ?, description = ? WHERE id = ?')
    .run(date, type, parseFloat(amount), description || null, req.params.id);

  logAudit(req.user.id, req.user.username, 'EDIT', 'Income', `Updated income #${req.params.id}`);
  res.json({ message: 'Income updated' });
});

// Delete income
router.delete('/:id', authorize('income'), (req, res) => {
  const income = db.prepare('SELECT * FROM income WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!income) return res.status(404).json({ error: 'Income not found' });

  db.prepare('DELETE FROM income WHERE id = ?').run(req.params.id);
  logAudit(req.user.id, req.user.username, 'DELETE', 'Income', `Deleted income Rs.${income.amount} — ${income.type}`);
  res.json({ message: 'Income deleted' });
});

export default router;
