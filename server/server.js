import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Uploads directory: use writable userData path in packaged app
const uploadsDir = process.env.USER_DATA_PATH
  ? path.join(process.env.USER_DATA_PATH, 'uploads')
  : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
console.log('[Server] Uploads dir:', uploadsDir);

import db from './database.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import restaurantRoutes from './routes/restaurant.js';
import auditLogRoutes from './routes/auditLogs.js';
import menuCategoryRoutes from './routes/menuCategories.js';
import menuItemRoutes from './routes/menuItems.js';
import inventoryRoutes from './routes/inventory.js';
import supplierRoutes from './routes/suppliers.js';
import purchaseRoutes from './routes/purchases.js';
import orderRoutes from './routes/orders.js';
import kitchenRoutes from './routes/kitchen.js';
import customerRoutes from './routes/customers.js';
import expenseRoutes from './routes/expenses.js';
import incomeRoutes from './routes/income.js';
import dailyClosingRoutes from './routes/dailyClosing.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';
import invoiceRoutes from './routes/invoice.js';
import backupRoutes from './routes/backups.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Serve built client in production (Electron)
// CLIENT_DIST_PATH is set by main.js pointing to the correct location
const clientDistPath = process.env.CLIENT_DIST_PATH || path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/menu/categories', menuCategoryRoutes);
app.use('/api/menu/items', menuItemRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/daily-closing', dailyClosingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/invoice', invoiceRoutes);
app.use('/api/backups', backupRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback
if (fs.existsSync(clientDistPath)) {
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
