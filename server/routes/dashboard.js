import { Router } from 'express';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get(['/', '/stats'], authorize('dashboard', 'pos', 'orders'), (req, res) => {
  const restaurantId = req.user.restaurant_id || 1;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  // Today's sales
  const todaySales = db.prepare(
    "SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count FROM orders WHERE restaurant_id = ? AND DATE(created_at) = ? AND status = 'completed'"
  ).get(restaurantId, today);

  // Today's all orders
  const todayOrders = db.prepare(
    'SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN status = \'pending\' THEN 1 ELSE 0 END), 0) as pending, COALESCE(SUM(CASE WHEN status = \'preparing\' THEN 1 ELSE 0 END), 0) as preparing FROM orders WHERE restaurant_id = ? AND DATE(created_at) = ?'
  ).get(restaurantId, today);

  // Monthly sales
  const monthlySales = db.prepare(
    "SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count FROM orders WHERE restaurant_id = ? AND DATE(created_at) >= ? AND status = 'completed'"
  ).get(restaurantId, monthStart);

  // Today's income & expenses
  const todayIncome = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE restaurant_id = ? AND date = ?')
    .get(restaurantId, today);
  const todayExpense = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE restaurant_id = ? AND date = ?')
    .get(restaurantId, today);

  // Low stock items
  const lowStock = db.prepare(
    'SELECT COUNT(*) as count FROM inventory WHERE restaurant_id = ? AND quantity <= low_stock_threshold'
  ).get(restaurantId);

  // Active users
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE restaurant_id = ?').get(restaurantId);

  // Total customers
  const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers WHERE restaurant_id = ?').get(restaurantId);

  // Menu items count
  const totalMenuItems = db.prepare('SELECT COUNT(*) as count FROM menu_items WHERE restaurant_id = ?').get(restaurantId);

  // Recent orders (last 8)
  const recentOrders = db.prepare(`
    SELECT o.order_number, o.order_type, o.status, o.total, o.created_at, o.table_number
    FROM orders o WHERE o.restaurant_id = ? ORDER BY o.created_at DESC LIMIT 8
  `).all(restaurantId);

  // Top selling items (this month)
  const topItems = db.prepare(`
    SELECT oi.item_name, SUM(oi.quantity) as qty, SUM(oi.total) as revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.restaurant_id = ? AND DATE(o.created_at) >= ? AND o.status = 'completed'
    GROUP BY oi.item_name ORDER BY qty DESC LIMIT 5
  `).all(restaurantId, monthStart);

  // Last 7 days sales trend
  const salesTrend = db.prepare(`
    SELECT DATE(created_at) as date, COALESCE(SUM(total), 0) as total, COUNT(*) as orders
    FROM orders WHERE restaurant_id = ? AND DATE(created_at) >= DATE('now', '-6 days') AND status = 'completed'
    GROUP BY DATE(created_at) ORDER BY date ASC
  `).all(restaurantId);

  // Payment type breakdown today
  const paymentBreakdown = db.prepare(`
    SELECT payment_type, COUNT(*) as count, COALESCE(SUM(total), 0) as total
    FROM orders WHERE restaurant_id = ? AND DATE(created_at) = ? AND status = 'completed'
    GROUP BY payment_type
  `).all(restaurantId, today);

  // Low stock items detail
  const lowStockItems = db.prepare(
    'SELECT name, quantity as current_stock, low_stock_threshold as min_stock, unit FROM inventory WHERE restaurant_id = ? AND quantity <= low_stock_threshold ORDER BY quantity ASC LIMIT 6'
  ).all(restaurantId);

  res.json({
    todaySales: { total: todaySales.total, count: todaySales.count },
    todayOrders: { total: todayOrders.total, pending: todayOrders.pending, preparing: todayOrders.preparing },
    monthlySales: { total: monthlySales.total, count: monthlySales.count },
    todayIncome: todayIncome.total,
    todayExpense: todayExpense.total,
    todayProfit: (todaySales.total + todayIncome.total) - todayExpense.total,
    lowStock: lowStock.count,
    totalUsers: totalUsers.count,
    totalCustomers: totalCustomers.count,
    totalMenuItems: totalMenuItems.count,
    recentOrders,
    topItems,
    salesTrend,
    paymentBreakdown,
    lowStockItems
  });
});

export default router;
