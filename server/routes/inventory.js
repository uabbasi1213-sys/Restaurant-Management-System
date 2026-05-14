import { Router } from 'express';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('inventory'), (req, res) => {
  const items = db.prepare(`
    SELECT * FROM inventory
    WHERE restaurant_id = ?
    ORDER BY name
  `).all(req.user.restaurant_id || 1);

  const result = items.map(item => ({
    ...item,
    is_low_stock: item.quantity <= item.low_stock_threshold
  }));
  res.json(result);
});

router.get('/low-stock', authorize('inventory'), (req, res) => {
  const items = db.prepare(`
    SELECT * FROM inventory
    WHERE restaurant_id = ? AND quantity <= low_stock_threshold
    ORDER BY quantity ASC
  `).all(req.user.restaurant_id || 1);
  res.json(items);
});

router.post('/', authorize('inventory'), (req, res) => {
  const { name, quantity, unit, cost, low_stock_threshold } = req.body;
  if (!name) return res.status(400).json({ error: 'Item name is required' });

  const result = db.prepare(`
    INSERT INTO inventory (name, quantity, unit, cost, low_stock_threshold, restaurant_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    name,
    parseFloat(quantity) || 0,
    unit || 'KG',
    parseFloat(cost) || 0,
    parseFloat(low_stock_threshold) || 10,
    req.user.restaurant_id || 1
  );

  logAudit(req.user.id, req.user.username, 'ADD', 'Inventory', `Added stock item: ${name}`);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Item added' });
});

router.put('/:id', authorize('inventory'), (req, res) => {
  const item = db.prepare('SELECT * FROM inventory WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const { name, quantity, unit, cost, low_stock_threshold } = req.body;
  if (!name) return res.status(400).json({ error: 'Item name is required' });

  db.prepare(`
    UPDATE inventory SET name = ?, quantity = ?, unit = ?, cost = ?,
    low_stock_threshold = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(
    name,
    parseFloat(quantity) || 0,
    unit || 'KG',
    parseFloat(cost) || 0,
    parseFloat(low_stock_threshold) || 10,
    req.params.id
  );

  logAudit(req.user.id, req.user.username, 'EDIT', 'Inventory', `Updated stock: ${name}`);
  res.json({ message: 'Item updated' });
});

router.delete('/:id', authorize('inventory'), (req, res) => {
  const item = db.prepare('SELECT * FROM inventory WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);
  logAudit(req.user.id, req.user.username, 'DELETE', 'Inventory', `Removed stock: ${item.name}`);
  res.json({ message: 'Item deleted' });
});

export default router;
