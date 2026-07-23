import db from '../database.js';

// No authentication required for desktop app - auto-assign admin user
export function authenticate(req, res, next) {
  const user = db.prepare(`
    SELECT u.*, r.name as role_name, r.permissions 
    FROM users u JOIN roles r ON u.role_id = r.id 
    WHERE u.id = 1
  `).get();

  if (user) {
    req.user = { ...user, permissions: JSON.parse(user.permissions) };
  } else {
    req.user = { id: 1, username: 'admin', role_name: 'Super Admin', permissions: ['all'], restaurant_id: 1 };
  }
  next();
}

export function authorize(...requiredPermissions) {
  return (req, res, next) => {
    // Desktop app - all permissions granted
    next();
  };
}
