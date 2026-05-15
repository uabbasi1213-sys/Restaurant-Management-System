import { Router } from 'express';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Sales report
router.get('/sales', authorize('reports', 'dashboard'), (req, res) => {
  const { date_from, date_to, group_by } = req.query;
  const rid = req.user.restaurant_id || 1;
  const from = date_from || new Date().toISOString().slice(0, 8) + '01';
  const to = date_to || new Date().toISOString().slice(0, 10);

  // Summary
  const summary = db.prepare(`
    SELECT COUNT(*) as total_orders, COALESCE(SUM(total), 0) as total_sales,
      COALESCE(SUM(CASE WHEN status='completed' THEN total ELSE 0 END), 0) as completed_sales,
      COALESCE(SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END), 0) as cancelled,
      COALESCE(AVG(CASE WHEN status='completed' THEN total END), 0) as avg_order
    FROM orders WHERE restaurant_id = ? AND DATE(created_at) BETWEEN ? AND ?
  `).get(rid, from, to);

  // By date
  const groupCol = group_by === 'month' ? "strftime('%Y-%m', created_at)" : 'DATE(created_at)';
  const byDate = db.prepare(`
    SELECT ${groupCol} as period, COUNT(*) as orders, COALESCE(SUM(total), 0) as sales
    FROM orders WHERE restaurant_id = ? AND DATE(created_at) BETWEEN ? AND ? AND status = 'completed'
    GROUP BY period ORDER BY period ASC
  `).all(rid, from, to);

  // By order type
  const byType = db.prepare(`
    SELECT order_type, COUNT(*) as orders, COALESCE(SUM(total), 0) as sales
    FROM orders WHERE restaurant_id = ? AND DATE(created_at) BETWEEN ? AND ? AND status = 'completed'
    GROUP BY order_type ORDER BY sales DESC
  `).all(rid, from, to);

  // By payment
  const byPayment = db.prepare(`
    SELECT payment_type, COUNT(*) as orders, COALESCE(SUM(total), 0) as sales
    FROM orders WHERE restaurant_id = ? AND DATE(created_at) BETWEEN ? AND ? AND status = 'completed'
    GROUP BY payment_type ORDER BY sales DESC
  `).all(rid, from, to);

  // Top items
  const topItems = db.prepare(`
    SELECT oi.item_name, SUM(oi.quantity) as qty, SUM(oi.total) as revenue
    FROM order_items oi JOIN orders o ON oi.order_id = o.id
    WHERE o.restaurant_id = ? AND DATE(o.created_at) BETWEEN ? AND ? AND o.status = 'completed'
    GROUP BY oi.item_name ORDER BY revenue DESC LIMIT 10
  `).all(rid, from, to);

  res.json({ summary, byDate, byType, byPayment, topItems });
});

// Expense report
router.get('/expenses', authorize('reports', 'dashboard'), (req, res) => {
  const { date_from, date_to } = req.query;
  const rid = req.user.restaurant_id || 1;
  const from = date_from || new Date().toISOString().slice(0, 8) + '01';
  const to = date_to || new Date().toISOString().slice(0, 10);

  const summary = db.prepare('SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE restaurant_id = ? AND date BETWEEN ? AND ?')
    .get(rid, from, to);

  const byCategory = db.prepare('SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE restaurant_id = ? AND date BETWEEN ? AND ? GROUP BY category ORDER BY total DESC')
    .all(rid, from, to);

  const byDate = db.prepare('SELECT date, COALESCE(SUM(amount), 0) as total FROM expenses WHERE restaurant_id = ? AND date BETWEEN ? AND ? GROUP BY date ORDER BY date ASC')
    .all(rid, from, to);

  res.json({ summary, byCategory, byDate });
});

// Profit & Loss
router.get('/profit-loss', authorize('reports', 'dashboard'), (req, res) => {
  const { date_from, date_to } = req.query;
  const rid = req.user.restaurant_id || 1;
  const from = date_from || new Date().toISOString().slice(0, 8) + '01';
  const to = date_to || new Date().toISOString().slice(0, 10);

  const salesIncome = db.prepare(
    "SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE restaurant_id = ? AND DATE(created_at) BETWEEN ? AND ? AND status = 'completed'"
  ).get(rid, from, to);

  const otherIncome = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE restaurant_id = ? AND date BETWEEN ? AND ?')
    .get(rid, from, to);

  const incomeByType = db.prepare('SELECT type, COALESCE(SUM(amount), 0) as total FROM income WHERE restaurant_id = ? AND date BETWEEN ? AND ? GROUP BY type ORDER BY total DESC')
    .all(rid, from, to);

  const totalExpense = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE restaurant_id = ? AND date BETWEEN ? AND ?')
    .get(rid, from, to);

  const expenseByCategory = db.prepare('SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses WHERE restaurant_id = ? AND date BETWEEN ? AND ? GROUP BY category ORDER BY total DESC')
    .all(rid, from, to);

  const totalIncome = salesIncome.total + otherIncome.total;
  const netProfit = totalIncome - totalExpense.total;

  res.json({
    totalIncome,
    salesIncome: salesIncome.total,
    otherIncome: otherIncome.total,
    incomeByType,
    totalExpense: totalExpense.total,
    expenseByCategory,
    netProfit,
    profitMargin: totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0
  });
});

// Inventory report
router.get('/inventory', authorize('reports', 'dashboard', 'inventory'), (req, res) => {
  const rid = req.user.restaurant_id || 1;

  const items = db.prepare(`
    SELECT i.*, 
      CASE WHEN i.current_stock <= i.min_stock THEN 1 ELSE 0 END as is_low,
      (i.current_stock * i.cost_price) as stock_value
    FROM inventory i WHERE i.restaurant_id = ? ORDER BY i.name ASC
  `).all(rid);

  const summary = {
    totalItems: items.length,
    lowStock: items.filter(i => i.is_low).length,
    totalValue: items.reduce((s, i) => s + (i.stock_value || 0), 0)
  };

  res.json({ summary, items });
});

// Customer report
router.get('/customers', authorize('reports', 'dashboard', 'customers'), (req, res) => {
  const rid = req.user.restaurant_id || 1;

  const topCustomers = db.prepare(`
    SELECT c.name, c.phone, c.balance, COUNT(o.id) as orders, COALESCE(SUM(o.total), 0) as spent
    FROM customers c LEFT JOIN orders o ON c.id = o.customer_id AND o.status = 'completed'
    WHERE c.restaurant_id = ?
    GROUP BY c.id ORDER BY spent DESC LIMIT 10
  `).all(rid);

  const summary = db.prepare(`
    SELECT COUNT(*) as total, 
      COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) as total_receivable,
      COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0) as total_advance
    FROM customers WHERE restaurant_id = ?
  `).get(rid);

  res.json({ summary, topCustomers });
});

export default router;
