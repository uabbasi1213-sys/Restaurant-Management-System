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
    cb(null, `logo-${Date.now()}${ext}`);
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

router.get('/', (req, res) => {
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.user.restaurant_id || 1);
  res.json(restaurant);
});

router.put('/', authorize('settings'), (req, res) => {
  const { name, address, phone, ntn, strn } = req.body;
  if (!name) return res.status(400).json({ error: 'Restaurant name is required' });

  db.prepare(
    'UPDATE restaurants SET name = ?, address = ?, phone = ?, ntn = ?, strn = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(name, address, phone, ntn || null, strn || null, req.user.restaurant_id || 1);

  logAudit(req.user.id, req.user.username, 'EDIT', 'Settings', `Updated restaurant profile: ${name}`);
  res.json({ message: 'Settings updated' });
});

router.post('/logo', authorize('settings'), upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const logoPath = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE restaurants SET logo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(logoPath, req.user.restaurant_id || 1);

  logAudit(req.user.id, req.user.username, 'EDIT', 'Settings', 'Updated restaurant logo');
  res.json({ logo: logoPath });
});

export default router;
