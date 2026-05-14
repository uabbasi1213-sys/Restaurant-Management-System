import jwt from 'jsonwebtoken';
import db from '../database.js';

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    const user = db.prepare(`
      SELECT u.*, r.name as role_name, r.permissions 
      FROM users u JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `).get(decoded.id);

    if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid token' });
    req.user = { ...user, permissions: JSON.parse(user.permissions) };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function authorize(...requiredPermissions) {
  return (req, res, next) => {
    const userPerms = req.user.permissions;
    if (userPerms.includes('all')) return next();
    const hasPermission = requiredPermissions.some(p => userPerms.includes(p));
    if (!hasPermission) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}
