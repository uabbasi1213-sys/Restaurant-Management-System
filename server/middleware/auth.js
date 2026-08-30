import jwt from 'jsonwebtoken';
import db from '../database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'restaurant_mgmt_secret_key_2024';

// ── Authenticate middleware ──
// Tries JWT token first; if missing/invalid, falls back to auto-admin (desktop convenience)
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7) : null;

  if (token && token !== 'desktop-app-token') {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.prepare(`
        SELECT u.*, r.name as role_name, r.permissions
        FROM users u JOIN roles r ON u.role_id = r.id
        WHERE u.id = ?
      `).get(decoded.id);

      if (user) {
        req.user = { ...user, permissions: JSON.parse(user.permissions || '[]') };
        return next();
      }
    } catch (err) {
      // Token invalid — fall through to auto-admin
    }
  }

  // Fallback: auto-assign first active user (desktop offline mode)
  const user = db.prepare(`
    SELECT u.*, r.name as role_name, r.permissions
    FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.is_active = 1 ORDER BY u.id ASC LIMIT 1
  `).get();

  if (user) {
    req.user = { ...user, permissions: JSON.parse(user.permissions || '[]') };
  } else {
    req.user = { id: 1, username: 'admin', role_name: 'Super Admin', permissions: ['all'], restaurant_id: 1 };
  }
  next();
}

// ── Authorize middleware ── (desktop: all permissions granted)
export function authorize(...requiredPermissions) {
  return (req, res, next) => {
    next(); // Desktop app — full access
  };
}
