import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `menu-${Date.now()}${ext}`);
  }
});

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, GIF, WebP) are allowed'));
    }
  }
});

router.use(authenticate);

router.get('/', authorize('menu'), (req, res) => {
  const { category_id, search } = req.query;
  let sql = `
    SELECT mi.*, mc.name as category_name
    FROM menu_items mi
    LEFT JOIN menu_categories mc ON mi.category_id = mc.id
    WHERE mi.restaurant_id = ?
  `;
  const params = [req.user.restaurant_id || 1];

  if (category_id) {
    sql += ' AND mi.category_id = ?';
    params.push(category_id);
  }

  if (search) {
    sql += ' AND mi.name LIKE ?';
    params.push(`%${search}%`);
  }

  sql += ' ORDER BY mc.name, mi.name';
  const items = db.prepare(sql).all(...params);
  res.json(items);
});

router.get('/:id', authorize('menu'), (req, res) => {
  const item = db.prepare(`
    SELECT mi.*, mc.name as category_name
    FROM menu_items mi
    LEFT JOIN menu_categories mc ON mi.category_id = mc.id
    WHERE mi.id = ? AND mi.restaurant_id = ?
  `).get(req.params.id, req.user.restaurant_id || 1);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

router.post('/', authorize('menu'), upload.single('image'), (req, res) => {
  const { name, category_id, cost_price, sale_price, description, barcode } = req.body;
  if (!name || !sale_price) return res.status(400).json({ error: 'Name and sale price are required' });

  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  const result = db.prepare(`
    INSERT INTO menu_items (name, category_id, cost_price, sale_price, image, description, barcode, restaurant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    category_id || null,
    parseFloat(cost_price) || 0,
    parseFloat(sale_price),
    imagePath,
    description || null,
    barcode || null,
    req.user.restaurant_id || 1
  );

  logAudit(req.user.id, req.user.username, 'ADD', 'Menu', `Created menu item: ${name}`);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Menu item created' });
});

router.put('/:id', authorize('menu'), upload.single('image'), (req, res) => {
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const { name, category_id, cost_price, sale_price, description, barcode } = req.body;
  if (!name || !sale_price) return res.status(400).json({ error: 'Name and sale price are required' });

  const imagePath = req.file ? `/uploads/${req.file.filename}` : item.image;

  db.prepare(`
    UPDATE menu_items SET name = ?, category_id = ?, cost_price = ?, sale_price = ?,
    image = ?, description = ?, barcode = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name,
    category_id || null,
    parseFloat(cost_price) || 0,
    parseFloat(sale_price),
    imagePath,
    description || null,
    barcode || null,
    req.params.id
  );

  logAudit(req.user.id, req.user.username, 'EDIT', 'Menu', `Updated menu item: ${name}`);
  res.json({ message: 'Menu item updated' });
});

router.patch('/:id/availability', authorize('menu'), (req, res) => {
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const newStatus = item.is_available ? 0 : 1;
  db.prepare('UPDATE menu_items SET is_available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newStatus, req.params.id);

  logAudit(req.user.id, req.user.username, 'EDIT', 'Menu',
    `${newStatus ? 'Enabled' : 'Disabled'} menu item: ${item.name}`);
  res.json({ is_available: newStatus, message: `Item ${newStatus ? 'enabled' : 'disabled'}` });
});

router.delete('/:id', authorize('menu'), (req, res) => {
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  logAudit(req.user.id, req.user.username, 'DELETE', 'Menu', `Deleted menu item: ${item.name}`);
  res.json({ message: 'Menu item deleted' });
});

export default router;
