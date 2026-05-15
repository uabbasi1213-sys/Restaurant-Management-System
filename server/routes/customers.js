import { Router } from 'express';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authenticate);

// List customers
router.get('/', authorize('customers', 'orders', 'pos'), (req, res) => {
  const { search } = req.query;
  let sql = `SELECT c.*, 
    (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) as total_orders,
    (SELECT COALESCE(SUM(total), 0) FROM orders WHERE customer_id = c.id AND status = 'completed') as total_spent
    FROM customers c WHERE c.restaurant_id = ?`;
  const params = [req.user.restaurant_id || 1];

  if (search) {
    sql += ' AND (c.name LIKE ? OR c.phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY c.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// Get single customer with transactions & orders
router.get('/:id', authorize('customers', 'orders'), (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const transactions = db.prepare(
    'SELECT * FROM customer_transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.params.id);

  const orders = db.prepare(
    'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(req.params.id);

  res.json({ ...customer, transactions, orders });
});

// Create customer
router.post('/', authorize('customers', 'pos'), (req, res) => {
  const { name, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const restaurantId = req.user.restaurant_id || 1;

  // Check duplicate phone
  if (phone) {
    const existing = db.prepare('SELECT id FROM customers WHERE phone = ? AND restaurant_id = ?')
      .get(phone, restaurantId);
    if (existing) return res.status(400).json({ error: 'Customer with this phone already exists' });
  }

  const result = db.prepare(
    'INSERT INTO customers (name, phone, address, restaurant_id) VALUES (?, ?, ?, ?)'
  ).run(name, phone || null, address || null, restaurantId);

  logAudit(req.user.id, req.user.username, 'ADD', 'Customers', `Added customer: ${name}`);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Customer added' });
});

// Update customer
router.put('/:id', authorize('customers'), (req, res) => {
  const { name, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  if (phone && phone !== customer.phone) {
    const dup = db.prepare('SELECT id FROM customers WHERE phone = ? AND restaurant_id = ? AND id != ?')
      .get(phone, req.user.restaurant_id || 1, req.params.id);
    if (dup) return res.status(400).json({ error: 'Phone already used by another customer' });
  }

  db.prepare('UPDATE customers SET name = ?, phone = ?, address = ? WHERE id = ?')
    .run(name, phone || null, address || null, req.params.id);

  logAudit(req.user.id, req.user.username, 'EDIT', 'Customers', `Updated customer: ${name}`);
  res.json({ message: 'Customer updated' });
});

// Delete customer
router.delete('/:id', authorize('customers'), (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const hasOrders = db.prepare('SELECT COUNT(*) as c FROM orders WHERE customer_id = ?').get(req.params.id);
  if (hasOrders.c > 0) return res.status(400).json({ error: 'Cannot delete customer with orders' });

  db.prepare('DELETE FROM customer_transactions WHERE customer_id = ?').run(req.params.id);
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);

  logAudit(req.user.id, req.user.username, 'DELETE', 'Customers', `Deleted customer: ${customer.name}`);
  res.json({ message: 'Customer deleted' });
});

// Add payment / transaction
router.post('/:id/transactions', authorize('customers', 'pos'), (req, res) => {
  const { type, amount, description } = req.body;
  if (!type || !amount) return res.status(400).json({ error: 'Type and amount required' });
  if (!['payment', 'credit', 'refund'].includes(type)) return res.status(400).json({ error: 'Invalid type' });

  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const amt = parseFloat(amount);
  db.prepare('INSERT INTO customer_transactions (customer_id, type, amount, description) VALUES (?, ?, ?, ?)')
    .run(req.params.id, type, amt, description || null);

  // Update balance: credit increases balance (owes), payment decreases
  const balanceChange = type === 'credit' ? amt : -amt;
  db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(balanceChange, req.params.id);

  logAudit(req.user.id, req.user.username, 'ADD', 'Customer Transactions',
    `${type} Rs.${amt.toFixed(2)} — ${customer.name}`);
  res.status(201).json({ message: 'Transaction recorded' });
});

// Get transactions
router.get('/:id/transactions', authorize('customers', 'orders'), (req, res) => {
  const txns = db.prepare('SELECT * FROM customer_transactions WHERE customer_id = ? ORDER BY created_at DESC')
    .all(req.params.id);
  res.json(txns);
});

export default router;
