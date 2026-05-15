import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupDir = path.join(__dirname, '..', 'backups');

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

const router = Router();
router.use(authenticate);

// List backups
router.get('/', authorize('backups'), (req, res) => {
  const rid = req.user.restaurant_id || 1;
  const backups = db.prepare(`
    SELECT b.*, u.full_name as created_by_name
    FROM backups b LEFT JOIN users u ON b.created_by = u.id
    WHERE b.restaurant_id = ? ORDER BY b.created_at DESC LIMIT 50
  `).all(rid);
  res.json(backups);
});

// Create backup
router.post('/', authorize('backups'), (req, res) => {
  const rid = req.user.restaurant_id || 1;
  const dbPath = path.join(__dirname, '..', 'restaurant.db');

  if (!fs.existsSync(dbPath)) return res.status(500).json({ error: 'Database file not found' });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.db`;
  const backupPath = path.join(backupDir, filename);

  try {
    fs.copyFileSync(dbPath, backupPath);
    const stats = fs.statSync(backupPath);

    const result = db.prepare(
      'INSERT INTO backups (filename, type, size, restaurant_id, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(filename, req.body.type || 'manual', stats.size, rid, req.user.id);

    logAudit(req.user.id, req.user.username, 'ADD', 'Backups', `Created backup: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
    res.status(201).json({ id: result.lastInsertRowid, filename, size: stats.size, message: 'Backup created successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create backup: ' + err.message });
  }
});

// Download backup
router.get('/download/:id', authorize('backups'), (req, res) => {
  const rid = req.user.restaurant_id || 1;
  const backup = db.prepare('SELECT * FROM backups WHERE id = ? AND restaurant_id = ?').get(req.params.id, rid);
  if (!backup) return res.status(404).json({ error: 'Backup not found' });

  const backupPath = path.join(backupDir, backup.filename);
  if (!fs.existsSync(backupPath)) return res.status(404).json({ error: 'Backup file not found on disk' });

  res.download(backupPath, backup.filename);
});

// Delete backup
router.delete('/:id', authorize('backups'), (req, res) => {
  const rid = req.user.restaurant_id || 1;
  const backup = db.prepare('SELECT * FROM backups WHERE id = ? AND restaurant_id = ?').get(req.params.id, rid);
  if (!backup) return res.status(404).json({ error: 'Backup not found' });

  const backupPath = path.join(backupDir, backup.filename);
  if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);

  db.prepare('DELETE FROM backups WHERE id = ?').run(req.params.id);
  logAudit(req.user.id, req.user.username, 'DELETE', 'Backups', `Deleted backup: ${backup.filename}`);
  res.json({ message: 'Backup deleted' });
});

// Restore backup
router.post('/restore/:id', authorize('backups'), (req, res) => {
  const rid = req.user.restaurant_id || 1;
  const backup = db.prepare('SELECT * FROM backups WHERE id = ? AND restaurant_id = ?').get(req.params.id, rid);
  if (!backup) return res.status(404).json({ error: 'Backup not found' });

  const backupPath = path.join(backupDir, backup.filename);
  if (!fs.existsSync(backupPath)) return res.status(404).json({ error: 'Backup file not found on disk' });

  const dbPath = path.join(__dirname, '..', 'restaurant.db');

  try {
    // Create a safety backup before restore
    const safetyName = `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    fs.copyFileSync(dbPath, path.join(backupDir, safetyName));

    // Restore
    fs.copyFileSync(backupPath, dbPath);
    logAudit(req.user.id, req.user.username, 'EDIT', 'Backups', `Restored from: ${backup.filename}`);
    res.json({ message: 'Database restored! Server restart required for changes to take effect.' });
  } catch (err) {
    res.status(500).json({ error: 'Restore failed: ' + err.message });
  }
});

// System info
router.get('/system-info', authorize('backups', 'settings'), (req, res) => {
  const rid = req.user.restaurant_id || 1;
  const dbPath = path.join(__dirname, '..', 'restaurant.db');
  const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;

  const counts = {
    users: db.prepare('SELECT COUNT(*) as c FROM users WHERE restaurant_id = ?').get(rid).c,
    orders: db.prepare('SELECT COUNT(*) as c FROM orders WHERE restaurant_id = ?').get(rid).c,
    menuItems: db.prepare('SELECT COUNT(*) as c FROM menu_items WHERE restaurant_id = ?').get(rid).c,
    customers: db.prepare('SELECT COUNT(*) as c FROM customers WHERE restaurant_id = ?').get(rid).c,
    inventory: db.prepare('SELECT COUNT(*) as c FROM inventory WHERE restaurant_id = ?').get(rid).c,
    suppliers: db.prepare('SELECT COUNT(*) as c FROM suppliers WHERE restaurant_id = ?').get(rid).c,
    expenses: db.prepare('SELECT COUNT(*) as c FROM expenses WHERE restaurant_id = ?').get(rid).c,
    income: db.prepare('SELECT COUNT(*) as c FROM income WHERE restaurant_id = ?').get(rid).c,
    backups: db.prepare('SELECT COUNT(*) as c FROM backups WHERE restaurant_id = ?').get(rid).c,
  };

  const backupCount = fs.existsSync(backupDir) ? fs.readdirSync(backupDir).filter(f => f.endsWith('.db')).length : 0;
  const backupSize = fs.existsSync(backupDir) 
    ? fs.readdirSync(backupDir).filter(f => f.endsWith('.db')).reduce((s, f) => s + fs.statSync(path.join(backupDir, f)).size, 0) 
    : 0;

  res.json({
    database: { size: dbSize, path: 'restaurant.db' },
    backups: { count: backupCount, totalSize: backupSize },
    records: counts,
    server: { nodeVersion: process.version, platform: process.platform, uptime: process.uptime() }
  });
});

export default router;
