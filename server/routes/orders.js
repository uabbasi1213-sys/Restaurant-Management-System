import { Router } from 'express';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authenticate);

function generateOrderNumber(restaurantId) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = db.prepare(`
    SELECT COUNT(*) as count FROM orders
    WHERE restaurant_id = ? AND DATE(created_at) = DATE('now')
  `).get(restaurantId);
  const num = ((count?.count || 0) + 1).toString().padStart(3, '0');
  return `ORD-${today}-${num}`;
}

// List orders
router.get('/', authorize('orders', 'pos'), (req, res) => {
  const { status, date, order_type } = req.query;
  let sql = `
    SELECT o.*, u.full_name as created_by_name, c.name as customer_name
    FROM orders o
    LEFT JOIN users u ON o.created_by = u.id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.restaurant_id = ?
  `;
  const params = [req.user.restaurant_id || 1];

  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  if (date) { sql += ' AND DATE(o.created_at) = ?'; params.push(date); }
  if (order_type) { sql += ' AND o.order_type = ?'; params.push(order_type); }

  sql += ' ORDER BY o.created_at DESC LIMIT 100';
  const orders = db.prepare(sql).all(...params);
  res.json(orders);
});

// Get order detail with items
router.get('/:id', authorize('orders', 'pos'), (req, res) => {
  const order = db.prepare(`
    SELECT o.*, u.full_name as created_by_name, c.name as customer_name
    FROM orders o
    LEFT JOIN users u ON o.created_by = u.id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.id = ? AND o.restaurant_id = ?
  `).get(req.params.id, req.user.restaurant_id || 1);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
  res.json({ ...order, items });
});

// Create order
router.post('/', authorize('orders', 'pos'), (req, res) => {
  const { order_type, table_number, customer_id, items, discount, tax, payment_type, special_instructions } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'At least one item is required' });

  const restaurantId = req.user.restaurant_id || 1;
  const orderNumber = generateOrderNumber(restaurantId);

  let subtotal = 0;
  items.forEach(item => { subtotal += item.price * item.quantity; });

  const taxAmount = parseFloat(tax) || 0;
  const discountAmount = parseFloat(discount) || 0;
  const total = subtotal + taxAmount - discountAmount;

  const orderResult = db.prepare(`
    INSERT INTO orders (order_number, order_type, table_number, customer_id, subtotal, tax, discount, total, payment_type, status, special_instructions, restaurant_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(
    orderNumber,
    order_type || 'dine-in',
    table_number || null,
    customer_id || null,
    subtotal, taxAmount, discountAmount, total,
    payment_type || 'cash',
    special_instructions || null,
    restaurantId,
    req.user.id
  );

  const orderId = orderResult.lastInsertRowid;

  items.forEach(item => {
    db.prepare(`
      INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, price, total, special_instructions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      item.menu_item_id,
      item.item_name,
      item.quantity,
      item.price,
      item.price * item.quantity,
      item.special_instructions || null
    );
  });

  logAudit(req.user.id, req.user.username, 'ADD', 'Orders',
    `New order ${orderNumber} — ${order_type} — Rs.${total.toFixed(2)}`);

  res.status(201).json({
    id: orderId,
    order_number: orderNumber,
    total,
    message: 'Order placed successfully!'
  });
});

// Update order status
router.patch('/:id/status', authorize('orders', 'pos', 'kitchen'), (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, req.params.id);

  if (['preparing', 'ready', 'completed'].includes(status)) {
    db.prepare('UPDATE order_items SET status = ? WHERE order_id = ?').run(status, req.params.id);
  }

  logAudit(req.user.id, req.user.username, 'EDIT', 'Orders',
    `Order ${order.order_number} status → ${status}`);
  res.json({ message: `Order status updated to ${status}` });
});

// Today's summary
router.get('/stats/today', authorize('orders', 'pos', 'dashboard'), (req, res) => {
  const restaurantId = req.user.restaurant_id || 1;

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_orders,
      COALESCE(SUM(total), 0) as total_sales,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END), 0) as completed_sales,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_orders,
      COALESCE(SUM(CASE WHEN status = 'preparing' THEN 1 ELSE 0 END), 0) as preparing_orders
    FROM orders
    WHERE restaurant_id = ? AND DATE(created_at) = DATE('now')
  `).get(restaurantId);

  res.json(stats);
});

export default router;
