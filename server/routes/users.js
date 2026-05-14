import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('users'), (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.role_id, u.is_active, u.created_at,
           r.name as role_name
    FROM users u JOIN roles r ON u.role_id = r.id
    ORDER BY u.created_at DESC
  `).all();
  res.json(users);
});

router.get('/roles', authorize('users'), (req, res) => {
  let roles = db.prepare('SELECT * FROM roles').all();
  if (req.user.role_name !== 'Super Admin') {
    roles = roles.filter(r => r.name !== 'Super Admin');
  }
  res.json(roles);
});

router.post('/', authorize('users'), (req, res) => {
  const { username, password, full_name, role_id } = req.body;
  if (!username || !password || !role_id) return res.status(400).json({ error: 'Required fields missing' });

  const targetRole = db.prepare('SELECT * FROM roles WHERE id = ?').get(role_id);
  if (targetRole?.name === 'Super Admin' && req.user.role_name !== 'Super Admin') {
    return res.status(403).json({ error: 'Only Super Admin can create Super Admin users' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(400).json({ error: 'Username already exists' });

  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password, full_name, role_id, restaurant_id) VALUES (?, ?, ?, ?, ?)'
  ).run(username, hashed, full_name, role_id, req.user.restaurant_id || 1);

  logAudit(req.user.id, req.user.username, 'ADD', 'Users', `Created user: ${username}`);
  res.status(201).json({ id: result.lastInsertRowid, message: 'User created' });
});

router.put('/:id', authorize('users'), (req, res) => {
  const { username, password, full_name, role_id, is_active } = req.body;
  const userId = req.params.id;

  const targetUser = db.prepare(`
    SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
  `).get(userId);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  if (targetUser.role_name === 'Super Admin' && req.user.role_name !== 'Super Admin') {
    return res.status(403).json({ error: 'Cannot modify Super Admin account' });
  }

  let query = 'UPDATE users SET full_name = ?, role_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP';
  let params = [full_name, role_id, is_active ? 1 : 0];

  if (username && username !== targetUser.username) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, userId);
    if (existing) return res.status(400).json({ error: 'Username already exists' });
    query += ', username = ?';
    params.push(username);
  }

  if (password) {
    query += ', password = ?';
    params.push(bcrypt.hashSync(password, 10));
  }

  query += ' WHERE id = ?';
  params.push(userId);

  db.prepare(query).run(...params);
  logAudit(req.user.id, req.user.username, 'EDIT', 'Users', `Updated user: ${targetUser.username}`);
  res.json({ message: 'User updated' });
});

router.delete('/:id', authorize('users'), (req, res) => {
  const userId = req.params.id;
  if (parseInt(userId) === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

  const targetUser = db.prepare(`
    SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
  `).get(userId);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  if (targetUser.role_name === 'Super Admin' && req.user.role_name !== 'Super Admin') {
    return res.status(403).json({ error: 'Cannot delete Super Admin' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  logAudit(req.user.id, req.user.username, 'DELETE', 'Users', `Deleted user: ${targetUser.username}`);
  res.json({ message: 'User deleted' });
});

export default router;
