import { Router } from 'express';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('purchases'), (req, res) => {
  const { supplier_id, from_date, to_date } = req.query;
  let sql = `
    SELECT p.*, s.name as supplier_name, i.name as item_name, i.unit as item_unit
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN inventory i ON p.item_id = i.id
    WHERE p.restaurant_id = ?
  `;
  const params = [req.user.restaurant_id || 1];

  if (supplier_id) {
    sql += ' AND p.supplier_id = ?';
    params.push(supplier_id);
  }
  if (from_date) {
    sql += ' AND DATE(p.created_at) >= ?';
    params.push(from_date);
  }
  if (to_date) {
    sql += ' AND DATE(p.created_at) <= ?';
    params.push(to_date);
  }

  sql += ' ORDER BY p.created_at DESC';
  const purchases = db.prepare(sql).all(...params);
  res.json(purchases);
});

router.post('/', authorize('purchases'), (req, res) => {
  const { supplier_id, item_id, quantity, rate } = req.body;
  if (!supplier_id || !item_id || !quantity || !rate) {
    return res.status(400).json({ error: 'Supplier, item, quantity, and rate are required' });
  }

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ? AND restaurant_id = ?')
    .get(supplier_id, req.user.restaurant_id || 1);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

  const item = db.prepare('SELECT * FROM inventory WHERE id = ? AND restaurant_id = ?')
    .get(item_id, req.user.restaurant_id || 1);
  if (!item) return res.status(404).json({ error: 'Inventory item not found' });

  const qty = parseFloat(quantity);
  const rt = parseFloat(rate);
  const total = qty * rt;

  // 1. Create purchase record
  const result = db.prepare(`
    INSERT INTO purchases (supplier_id, item_id, quantity, rate, total, restaurant_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(supplier_id, item_id, qty, rt, total, req.user.restaurant_id || 1);

  // 2. Update inventory quantity (auto stock increase)
  db.prepare('UPDATE inventory SET quantity = quantity + ?, cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(qty, rt, item_id);

  // 3. Add supplier transaction (purchase entry in ledger)
  db.prepare(`
    INSERT INTO supplier_transactions (supplier_id, type, amount, description)
    VALUES (?, 'purchase', ?, ?)
  `).run(supplier_id, total, `Purchase: ${item.name} (${qty} ${item.unit} @ Rs.${rt})`);

  // 4. Update supplier balance
  const totals = db.prepare(`
    SELECT type, SUM(amount) as total FROM supplier_transactions
    WHERE supplier_id = ? GROUP BY type
  `).all(supplier_id);

  let purchases = 0, payments = 0;
  totals.forEach(t => {
    if (t.type === 'purchase') purchases = t.total;
    if (t.type === 'payment') payments = t.total;
  });
  db.prepare('UPDATE suppliers SET balance = ? WHERE id = ?').run(purchases - payments, supplier_id);

  logAudit(req.user.id, req.user.username, 'ADD', 'Purchases',
    `Purchase: ${item.name} (${qty} ${item.unit}) from ${supplier.name} — Rs.${total}`);

  res.status(201).json({ id: result.lastInsertRowid, total, message: 'Purchase recorded' });
});

router.delete('/:id', authorize('purchases'), (req, res) => {
  const purchase = db.prepare(`
    SELECT p.*, s.name as supplier_name, i.name as item_name
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN inventory i ON p.item_id = i.id
    WHERE p.id = ? AND p.restaurant_id = ?
  `).get(req.params.id, req.user.restaurant_id || 1);
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

  // Reverse inventory update
  db.prepare('UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(purchase.quantity, purchase.item_id);

  // Remove the supplier transaction for this purchase
  // Find matching transaction by amount and description pattern
  db.prepare(`
    DELETE FROM supplier_transactions WHERE id = (
      SELECT id FROM supplier_transactions
      WHERE supplier_id = ? AND type = 'purchase' AND amount = ?
      ORDER BY created_at DESC LIMIT 1
    )
  `).run(purchase.supplier_id, purchase.total);

  // Recalculate supplier balance
  const totals = db.prepare(`
    SELECT type, SUM(amount) as total FROM supplier_transactions
    WHERE supplier_id = ? GROUP BY type
  `).all(purchase.supplier_id);

  let purchasesTotal = 0, paymentsTotal = 0;
  totals.forEach(t => {
    if (t.type === 'purchase') purchasesTotal = t.total;
    if (t.type === 'payment') paymentsTotal = t.total;
  });
  db.prepare('UPDATE suppliers SET balance = ? WHERE id = ?')
    .run(purchasesTotal - paymentsTotal, purchase.supplier_id);

  // Delete purchase record
  db.prepare('DELETE FROM purchases WHERE id = ?').run(req.params.id);

  logAudit(req.user.id, req.user.username, 'DELETE', 'Purchases',
    `Deleted purchase: ${purchase.item_name} from ${purchase.supplier_name}`);
  res.json({ message: 'Purchase deleted and inventory/ledger reversed' });
});

export default router;
