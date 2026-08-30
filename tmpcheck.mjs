import('./dist-electron/Restaurant Management System-win32-x64/resources/app/server/database.js').then(m => {
  const db = m.default;
  
  // Check orphan items (order_id=0)
  const orphans = db.prepare('SELECT * FROM order_items WHERE order_id=0 OR order_id IS NULL').all();
  console.log('Orphan items to fix:', orphans.length);
  
  // Get all orders
  const orders = db.prepare('SELECT id, order_number, total, created_at FROM orders ORDER BY id').all();
  console.log('All orders:', JSON.stringify(orders, null, 2));
  
  // Delete orphan items (they belong to failed orders - we cannot recover which order they belong to)
  const del = db.prepare('DELETE FROM order_items WHERE order_id=0 OR order_id IS NULL').run();
  console.log('Deleted orphans:', del.changes);
  
  const final = db.prepare('SELECT * FROM order_items').all();
  console.log('Final items in DB:', JSON.stringify(final, null, 2));
}).catch(e=>console.error(e));
