import { Router } from 'express';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authenticate);

// --- Supplier CRUD ---

router.get('/', authorize('suppliers'), (req, res) => {
  const suppliers = db.prepare(`
    SELECT * FROM suppliers WHERE restaurant_id = ? ORDER BY name
  `).all(req.user.restaurant_id || 1);
  res.json(suppliers);
});

router.post('/', authorize('suppliers'), (req, res) => {
  const { name, company, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Supplier name is required' });

  const result = db.prepare(`
    INSERT INTO suppliers (name, company, phone, address, balance, restaurant_id)
    VALUES (?, ?, ?, ?, 0, ?)
  `).run(name, company || null, phone || null, address || null, req.user.restaurant_id || 1);

  logAudit(req.user.id, req.user.username, 'ADD', 'Suppliers', `Added supplier: ${name}`);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Supplier added' });
});

router.put('/:id', authorize('suppliers'), (req, res) => {
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

  const { name, company, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Supplier name is required' });

  db.prepare(`
    UPDATE suppliers SET name = ?, company = ?, phone = ?, address = ? WHERE id = ?
  `).run(name, company || null, phone || null, address || null, req.params.id);

  logAudit(req.user.id, req.user.username, 'EDIT', 'Suppliers', `Updated supplier: ${name}`);
  res.json({ message: 'Supplier updated' });
});

router.delete('/:id', authorize('suppliers'), (req, res) => {
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

  const txnCount = db.prepare('SELECT COUNT(*) as count FROM supplier_transactions WHERE supplier_id = ?')
    .get(req.params.id);
  if (txnCount.count > 0) {
    return res.status(400).json({ error: 'Cannot delete supplier with transactions. Clear ledger first.' });
  }

  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  logAudit(req.user.id, req.user.username, 'DELETE', 'Suppliers', `Deleted supplier: ${supplier.name}`);
  res.json({ message: 'Supplier deleted' });
});

// --- Supplier Ledger ---

router.get('/:id/ledger', authorize('suppliers'), (req, res) => {
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

  const transactions = db.prepare(`
    SELECT * FROM supplier_transactions
    WHERE supplier_id = ?
    ORDER BY created_at DESC
  `).all(req.params.id);

  // Calculate balance: Total Purchases - Total Payments
  let totalPurchases = 0;
  let totalPayments = 0;
  transactions.forEach(t => {
    if (t.type === 'purchase') totalPurchases += t.amount;
    if (t.type === 'payment') totalPayments += t.amount;
  });
  const balance = totalPurchases - totalPayments;

  res.json({ supplier, transactions, totalPurchases, totalPayments, balance });
});

router.post('/:id/payment', authorize('suppliers'), (req, res) => {
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

  const { amount, description } = req.body;
  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }

  db.prepare(`
    INSERT INTO supplier_transactions (supplier_id, type, amount, description)
    VALUES (?, 'payment', ?, ?)
  `).run(req.params.id, parseFloat(amount), description || 'Payment');

  // Recalculate and update supplier balance
  const totals = db.prepare(`
    SELECT type, SUM(amount) as total FROM supplier_transactions
    WHERE supplier_id = ? GROUP BY type
  `).all(req.params.id);

  let purchases = 0, payments = 0;
  totals.forEach(t => {
    if (t.type === 'purchase') purchases = t.total;
    if (t.type === 'payment') payments = t.total;
  });

  db.prepare('UPDATE suppliers SET balance = ? WHERE id = ?').run(purchases - payments, req.params.id);

  logAudit(req.user.id, req.user.username, 'ADD', 'Suppliers',
    `Payment Rs.${amount} to supplier: ${supplier.name}`);
  res.json({ message: 'Payment recorded', balance: purchases - payments });
});

export default router;
