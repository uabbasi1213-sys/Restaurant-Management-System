import { Router } from 'express';
import db from '../database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Desktop app - auto login, no credentials needed
router.post('/login', (req, res) => {
  const user = db.prepare(`
    SELECT u.*, r.name as role_name, r.permissions 
    FROM users u JOIN roles r ON u.role_id = r.id 
    WHERE u.id = 1
  `).get();

  res.json({
    token: 'desktop-app-token',
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role_name,
      permissions: JSON.parse(user.permissions)
    }
  });
});

router.get('/me', authenticate, (req, res) => {
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.user.restaurant_id || 1);
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      full_name: req.user.full_name,
      role: req.user.role_name,
      permissions: req.user.permissions
    },
    restaurant
  });
});

export default router;
