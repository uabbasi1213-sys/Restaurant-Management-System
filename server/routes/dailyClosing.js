import { Router } from 'express';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authenticate);

// Get today's live summary (before closing)
router.get('/today', authorize('daily_closing', 'dashboard'), (req, res) => {
  const restaurantId = req.user.restaurant_id || 1;
  const today = new Date().toISOString().slice(0, 10);

  // Check if already closed
  const existing = db.prepare('SELECT * FROM daily_closing WHERE date = ? AND restaurant_id = ?')
    .get(today, restaurantId);

  // Get previous closing balance as today's opening
  const lastClosing = db.prepare(
    'SELECT closing_balance FROM daily_closing WHERE restaurant_id = ? AND date < ? ORDER BY date DESC LIMIT 1'
  ).get(restaurantId, today);
  const openingBalance = lastClosing?.closing_balance || 0;

  // Today's income from income table
  const incomeResult = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE restaurant_id = ? AND date = ?')
    .get(restaurantId, today);

  // Today's completed order sales (if not already in income)
  const orderSales = db.prepare(
    "SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE restaurant_id = ? AND DATE(created_at) = ? AND status = 'completed'"
  ).get(restaurantId, today);

  // Today's expenses
  const expenseResult = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE restaurant_id = ? AND date = ?')
    .get(restaurantId, today);

  // Order stats
  const orderStats = db.prepare(`
    SELECT
      COUNT(*) as total_orders,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completed,
      COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled,
      COALESCE(SUM(CASE WHEN status IN ('pending','preparing') THEN 1 ELSE 0 END), 0) as active
    FROM orders WHERE restaurant_id = ? AND DATE(created_at) = ?
  `).get(restaurantId, today);

  // Payment breakdown
  const paymentBreakdown = db.prepare(`
    SELECT payment_type, COUNT(*) as count, COALESCE(SUM(total), 0) as total
    FROM orders WHERE restaurant_id = ? AND DATE(created_at) = ? AND status = 'completed'
    GROUP BY payment_type
  `).all(restaurantId, today);

  // Expense breakdown by category
  const expenseBreakdown = db.prepare(`
    SELECT category, COALESCE(SUM(amount), 0) as total
    FROM expenses WHERE restaurant_id = ? AND date = ?
    GROUP BY category ORDER BY total DESC
  `).all(restaurantId, today);

  const totalIncome = incomeResult.total + orderSales.total;
  const totalExpense = expenseResult.total;
  const closingBalance = openingBalance + totalIncome - totalExpense;

  res.json({
    date: today,
    is_closed: !!existing,
    closing_record: existing || null,
    opening_balance: openingBalance,
    total_income: totalIncome,
    income_manual: incomeResult.total,
    income_orders: orderSales.total,
    total_expense: totalExpense,
    closing_balance: closingBalance,
    net_profit: totalIncome - totalExpense,
    orders: orderStats,
    paymentBreakdown,
    expenseBreakdown
  });
});

// Close the day
router.post('/close', authorize('daily_closing'), (req, res) => {
  const restaurantId = req.user.restaurant_id || 1;
  const today = new Date().toISOString().slice(0, 10);

  // Check if already closed
  const existing = db.prepare('SELECT id FROM daily_closing WHERE date = ? AND restaurant_id = ?')
    .get(today, restaurantId);
  if (existing) return res.status(400).json({ error: 'Day already closed' });

  // Calculate same as /today
  const lastClosing = db.prepare(
    'SELECT closing_balance FROM daily_closing WHERE restaurant_id = ? AND date < ? ORDER BY date DESC LIMIT 1'
  ).get(restaurantId, today);
  const openingBalance = lastClosing?.closing_balance || 0;

  const incomeResult = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE restaurant_id = ? AND date = ?')
    .get(restaurantId, today);
  const orderSales = db.prepare(
    "SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE restaurant_id = ? AND DATE(created_at) = ? AND status = 'completed'"
  ).get(restaurantId, today);
  const expenseResult = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE restaurant_id = ? AND date = ?')
    .get(restaurantId, today);

  const totalIncome = incomeResult.total + orderSales.total;
  const totalExpense = expenseResult.total;
  const closingBalance = openingBalance + totalIncome - totalExpense;

  db.prepare(
    'INSERT INTO daily_closing (date, opening_balance, total_income, total_expense, closing_balance, restaurant_id, closed_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(today, openingBalance, totalIncome, totalExpense, closingBalance, restaurantId, req.user.id);

  logAudit(req.user.id, req.user.username, 'ADD', 'Daily Closing',
    `Day closed — Income: Rs.${totalIncome.toFixed(2)}, Expense: Rs.${totalExpense.toFixed(2)}, Balance: Rs.${closingBalance.toFixed(2)}`);

  res.json({ message: 'Day closed successfully', closing_balance: closingBalance });
});

// History of closings
router.get('/history', authorize('daily_closing', 'dashboard'), (req, res) => {
  const restaurantId = req.user.restaurant_id || 1;
  const closings = db.prepare(`
    SELECT dc.*, u.full_name as closed_by_name
    FROM daily_closing dc
    LEFT JOIN users u ON dc.closed_by = u.id
    WHERE dc.restaurant_id = ?
    ORDER BY dc.date DESC LIMIT 60
  `).all(restaurantId);
  res.json(closings);
});

// Reopen (delete closing for re-correction)
router.delete('/:date', authorize('daily_closing'), (req, res) => {
  const restaurantId = req.user.restaurant_id || 1;
  const closing = db.prepare('SELECT * FROM daily_closing WHERE date = ? AND restaurant_id = ?')
    .get(req.params.date, restaurantId);
  if (!closing) return res.status(404).json({ error: 'Closing not found' });

  db.prepare('DELETE FROM daily_closing WHERE date = ? AND restaurant_id = ?')
    .run(req.params.date, restaurantId);

  logAudit(req.user.id, req.user.username, 'DELETE', 'Daily Closing', `Reopened day: ${req.params.date}`);
  res.json({ message: 'Day reopened' });
});

export default router;
