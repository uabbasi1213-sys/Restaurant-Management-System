import { Router } from 'express';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authenticate);

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Ingredients', 'Maintenance', 'Marketing', 'Transport', 'Equipment', 'Cleaning', 'Other'];

// List expenses
router.get('/', authorize('expenses', 'dashboard'), (req, res) => {
  const { date_from, date_to, category } = req.query;
  let sql = 'SELECT e.*, u.full_name as created_by_name FROM expenses e LEFT JOIN users u ON e.created_by = u.id WHERE e.restaurant_id = ?';
  const params = [req.user.restaurant_id || 1];

  if (date_from) { sql += ' AND e.date >= ?'; params.push(date_from); }
  if (date_to) { sql += ' AND e.date <= ?'; params.push(date_to); }
  if (category) { sql += ' AND e.category = ?'; params.push(category); }

  sql += ' ORDER BY e.date DESC, e.created_at DESC LIMIT 200';
  res.json(db.prepare(sql).all(...params));
});

// Get categories
router.get('/categories', (req, res) => {
  res.json(CATEGORIES);
});

// Summary stats
router.get('/summary', authorize('expenses', 'dashboard'), (req, res) => {
  const restaurantId = req.user.restaurant_id || 1;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const todayTotal = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE restaurant_id = ? AND date = ?')
    .get(restaurantId, today);
  const monthTotal = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE restaurant_id = ? AND date >= ?')
    .get(restaurantId, monthStart);
  const byCategory = db.prepare('SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses WHERE restaurant_id = ? AND date >= ? GROUP BY category ORDER BY total DESC')
    .all(restaurantId, monthStart);

  res.json({ today: todayTotal.total, month: monthTotal.total, byCategory });
});

// Create expense
router.post('/', authorize('expenses'), (req, res) => {
  const { date, description, amount, category } = req.body;
  if (!date || !description || !amount) return res.status(400).json({ error: 'Date, description and amount are required' });
  if (parseFloat(amount) <= 0) return res.status(400).json({ error: 'Amount must be positive' });

  const result = db.prepare(
    'INSERT INTO expenses (date, description, amount, category, restaurant_id, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(date, description, parseFloat(amount), category || 'Other', req.user.restaurant_id || 1, req.user.id);

  logAudit(req.user.id, req.user.username, 'ADD', 'Expenses', `Expense Rs.${parseFloat(amount).toFixed(2)} — ${description}`);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Expense added' });
});

// Update expense
router.put('/:id', authorize('expenses'), (req, res) => {
  const { date, description, amount, category } = req.body;
  if (!date || !description || !amount) return res.status(400).json({ error: 'Date, description and amount are required' });

  const expense = db.prepare('SELECT * FROM expenses WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });

  db.prepare('UPDATE expenses SET date = ?, description = ?, amount = ?, category = ? WHERE id = ?')
    .run(date, description, parseFloat(amount), category || 'Other', req.params.id);

  logAudit(req.user.id, req.user.username, 'EDIT', 'Expenses', `Updated expense #${req.params.id}`);
  res.json({ message: 'Expense updated' });
});

// Delete expense
router.delete('/:id', authorize('expenses'), (req, res) => {
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });

  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  logAudit(req.user.id, req.user.username, 'DELETE', 'Expenses', `Deleted expense Rs.${expense.amount} — ${expense.description}`);
  res.json({ message: 'Expense deleted' });
});

export default router;
