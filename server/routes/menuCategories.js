import { Router } from 'express';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('menu'), (req, res) => {
  const categories = db.prepare(`
    SELECT mc.*, COUNT(mi.id) as item_count
    FROM menu_categories mc
    LEFT JOIN menu_items mi ON mi.category_id = mc.id
    WHERE mc.restaurant_id = ?
    GROUP BY mc.id
    ORDER BY mc.name
  `).all(req.user.restaurant_id || 1);
  res.json(categories);
});

router.post('/', authorize('menu'), (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  const existing = db.prepare(
    'SELECT id FROM menu_categories WHERE name = ? AND restaurant_id = ?'
  ).get(name, req.user.restaurant_id || 1);
  if (existing) return res.status(400).json({ error: 'Category already exists' });

  const result = db.prepare(
    'INSERT INTO menu_categories (name, restaurant_id) VALUES (?, ?)'
  ).run(name, req.user.restaurant_id || 1);

  logAudit(req.user.id, req.user.username, 'ADD', 'Menu', `Created category: ${name}`);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Category created' });
});

router.put('/:id', authorize('menu'), (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  const category = db.prepare('SELECT * FROM menu_categories WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  db.prepare('UPDATE menu_categories SET name = ? WHERE id = ?').run(name, req.params.id);
  logAudit(req.user.id, req.user.username, 'EDIT', 'Menu', `Updated category: ${name}`);
  res.json({ message: 'Category updated' });
});

router.delete('/:id', authorize('menu'), (req, res) => {
  const category = db.prepare('SELECT * FROM menu_categories WHERE id = ? AND restaurant_id = ?')
    .get(req.params.id, req.user.restaurant_id || 1);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const itemCount = db.prepare('SELECT COUNT(*) as count FROM menu_items WHERE category_id = ?')
    .get(req.params.id);
  if (itemCount.count > 0) {
    return res.status(400).json({ error: `Cannot delete — ${itemCount.count} items in this category. Remove items first.` });
  }

  db.prepare('DELETE FROM menu_categories WHERE id = ?').run(req.params.id);
  logAudit(req.user.id, req.user.username, 'DELETE', 'Menu', `Deleted category: ${category.name}`);
  res.json({ message: 'Category deleted' });
});

export default router;
