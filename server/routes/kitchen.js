import { Router } from 'express';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Get active kitchen orders (pending + preparing)
router.get('/orders', authorize('kitchen', 'orders', 'pos'), (req, res) => {
  const restaurantId = req.user.restaurant_id || 1;
  const orders = db.prepare(`
    SELECT o.*, u.full_name as created_by_name
    FROM orders o
    LEFT JOIN users u ON o.created_by = u.id
    WHERE o.restaurant_id = ? AND o.status IN ('pending', 'preparing')
    ORDER BY
      CASE o.status WHEN 'pending' THEN 1 WHEN 'preparing' THEN 2 END,
      o.created_at ASC
  `).all(restaurantId);

  const result = orders.map(order => {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    return { ...order, items };
  });

  res.json(result);
});

// Get kitchen stats
router.get('/stats', authorize('kitchen', 'orders', 'pos', 'dashboard'), (req, res) => {
  const restaurantId = req.user.restaurant_id || 1;
  const stats = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending,
      COALESCE(SUM(CASE WHEN status = 'preparing' THEN 1 ELSE 0 END), 0) as preparing,
      COALESCE(SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END), 0) as ready,
      COALESCE(SUM(CASE WHEN status = 'completed' AND DATE(updated_at) = DATE('now') THEN 1 ELSE 0 END), 0) as completed_today
    FROM orders WHERE restaurant_id = ? AND DATE(created_at) = DATE('now')
  `).get(restaurantId);
  res.json(stats);
});

// Update individual item status
router.patch('/items/:itemId/status', authorize('kitchen', 'orders'), (req, res) => {
  const { status } = req.body;
  if (!['pending', 'preparing', 'ready'].includes(status)) {
    return res.status(400).json({ error: 'Invalid item status' });
  }

  const item = db.prepare('SELECT oi.*, o.restaurant_id FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.id = ?')
    .get(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.restaurant_id !== (req.user.restaurant_id || 1)) return res.status(403).json({ error: 'Forbidden' });

  db.prepare('UPDATE order_items SET status = ? WHERE id = ?').run(status, req.params.itemId);

  // Auto-update order status: if all items ready → order ready
  const allItems = db.prepare('SELECT status FROM order_items WHERE order_id = ?').all(item.order_id);
  const allReady = allItems.every(i => i.status === 'ready');
  const anyPreparing = allItems.some(i => i.status === 'preparing');

  if (allReady) {
    db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('ready', item.order_id);
  } else if (anyPreparing) {
    db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('preparing', item.order_id);
  }

  res.json({ message: 'Item status updated' });
});

export default router;
