import { Router } from 'express';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Get invoice data for an order
router.get('/:orderId', authorize('orders', 'pos', 'kitchen'), (req, res) => {
  const rid = req.user.restaurant_id || 1;

  const order = db.prepare(`
    SELECT o.*, u.full_name as cashier_name, c.name as customer_name, c.phone as customer_phone
    FROM orders o
    LEFT JOIN users u ON o.created_by = u.id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.id = ? AND o.restaurant_id = ?
  `).get(req.params.orderId, rid);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.orderId);

  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(rid);

  res.json({
    restaurant: {
      name: restaurant?.name || 'Restaurant',
      address: restaurant?.address || '',
      phone: restaurant?.phone || '',
      email: restaurant?.email || '',
      logo: restaurant?.logo || null,
    },
    order: {
      ...order,
      items
    }
  });
});

export default router;
