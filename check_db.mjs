import Database from './dist-electron/Restaurant Management System-win32-x64/resources/app/server/node_modules/better-sqlite3/lib/index.js';

// Use the actual db file
const db = new Database('./dist-electron/Restaurant Management System-win32-x64/resources/app/server/restaurant.db');

const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='orders'").get();
console.log('=== ORDERS SCHEMA ===');
console.log(schema?.sql);

const triggers = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='trigger'").all();
console.log('\n=== TRIGGERS ===');
console.log(JSON.stringify(triggers.map(t => t.name)));

// Test insert directly
try {
  const r = db.prepare("INSERT INTO orders (order_number, order_type, subtotal, tax, discount, total, payment_type, status, restaurant_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)").run('TEST-002','dine-in',100,0,0,100,'cash','pending',1,1);
  console.log('\nTest INSERT result:', r);
  db.prepare("DELETE FROM orders WHERE order_number='TEST-002'").run();
} catch(e) {
  console.log('\nINSERT ERROR:', e.message);
}

db.close();
