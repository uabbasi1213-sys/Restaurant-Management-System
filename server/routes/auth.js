import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'restaurant_mgmt_secret_key_2024';

// ── Login (Desktop offline: auto-login if no credentials, or verify username/password) ──
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    let user;

    if (!username && !password) {
      // Auto-login: return first active admin user (Desktop convenience mode)
      user = db.prepare(`
        SELECT u.*, r.name as role_name, r.permissions
        FROM users u JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1
        ORDER BY u.id ASC LIMIT 1
      `).get();

      if (!user) return res.status(404).json({ error: 'No user found. Please set up the system.' });
    } else {
      // Normal login with credentials
      if (!username || !password)
        return res.status(400).json({ error: 'Username and password are required' });

      user = db.prepare(`
        SELECT u.*, r.name as role_name, r.permissions
        FROM users u JOIN roles r ON u.role_id = r.id
        WHERE u.username = ? AND u.is_active = 1
      `).get(username);

      if (!user) return res.status(401).json({ error: 'Invalid username or password' });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role_name: user.role_name, restaurant_id: user.restaurant_id || 1 },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role_name,
        permissions: JSON.parse(user.permissions || '[]'),
        restaurant_id: user.restaurant_id || 1,
      }
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ── Get current user info ──
router.get('/me', authenticate, (req, res) => {
  try {
    const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?')
      .get(req.user.restaurant_id || 1);
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        full_name: req.user.full_name,
        role: req.user.role_name,
        permissions: req.user.permissions || [],
        restaurant_id: req.user.restaurant_id || 1,
      },
      restaurant
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

export default router;
