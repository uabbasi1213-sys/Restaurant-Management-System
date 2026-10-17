import { supabase } from '../supabase';

const isElectron = import.meta.env.VITE_MODE === 'electron';
const BASE_URL = isElectron
  ? (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api'
  : (import.meta.env.VITE_API_URL || '/api');

function getToken() {
  return localStorage.getItem('desktop_token') || localStorage.getItem('token') || '';
}

let cachedTenantId = null;
let lastSessionUserId = null;

if (supabase) {
  try {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.id) {
        if (lastSessionUserId !== session.user.id) {
          cachedTenantId = null;
          lastSessionUserId = null;
        }
      } else {
        cachedTenantId = null;
        lastSessionUserId = null;
      }
    });
  } catch (e) {
    // ignore
  }
}

async function getTenantId() {
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        if (cachedTenantId && lastSessionUserId === session.user.id) {
          return cachedTenantId;
        }
        const { data: prof } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).maybeSingle();
        if (prof?.tenant_id) {
          cachedTenantId = prof.tenant_id;
          lastSessionUserId = session.user.id;
          localStorage.setItem('tenant_id', prof.tenant_id);
          return prof.tenant_id;
        }
      }
    } catch {
      // ignore
    }
  }
  const stored = localStorage.getItem('tenant_id');
  if (stored) return stored;
  return null;
}


export function getOrderDateString(item) {
  if (!item) return new Date().toLocaleDateString('en-CA');
  if (item.order_number) {
    const match = String(item.order_number).match(/ORD-(\d{4})(\d{2})(\d{2})-/i);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  if (item.date) {
    const dStr = String(item.date).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return dStr;
  }
  if (item.created_at) {
    const d = new Date(item.created_at);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-CA');
    return String(item.created_at).slice(0, 10);
  }
  return new Date().toLocaleDateString('en-CA');
}

export function getTodayString() {
  return new Date().toLocaleDateString('en-CA');
}

export function isValidUUID(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function bodyToPayload(body) {
  if (!body) return {};
  if (body instanceof FormData) {
    const payload = {};
    for (const [key, value] of body.entries()) {
      if (value instanceof File) {
        if (value.size > 0 && value.type.startsWith('image/')) {
          try {
            payload.image = await fileToBase64(value);
          } catch (e) {
            console.warn('Failed to convert image file to base64:', e);
          }
        }
      } else {
        payload[key] = value;
      }
    }
    if (payload.image_url && !payload.image) {
      payload.image = payload.image_url;
    }
    return payload;
  }
  return typeof body === 'object' ? { ...body } : {};
}

async function requestHTTP(method, path, body) {
  const token = getToken();
  const headers = {};

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('API server unavailable or returned HTML');
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Invalid response format from server');
  }

  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

// Generic Supabase Table Helper for Online SaaS Mode
async function supabaseTableOp(tableName, method, path, body, orderCol = 'created_at') {
  const tenant_id = await getTenantId();
  const cleanPath = path.split('?')[0].replace(/^\/api/, '');

  if (method === 'GET') {
    let query = supabase.from(tableName).select('*');
    if (tenant_id && tableName !== 'tenants') {
      query = query.eq('tenant_id', tenant_id);
    }
    if (orderCol) {
      query = query.order(orderCol, { ascending: false });
    }
    const { data, error } = await query;
    if (error) {
      console.warn(`Supabase SELECT ${tableName} error:`, error.message);
      return [];
    }
    return data || [];
  }

  if (method === 'POST') {
    const payload = await bodyToPayload(body);
    if (tenant_id && !payload.tenant_id && tableName !== 'tenants') {
      payload.tenant_id = tenant_id;
    }
    if (payload.cost_price !== undefined) payload.cost_price = Number(payload.cost_price) || 0;
    if (payload.sale_price !== undefined) payload.sale_price = Number(payload.sale_price) || 0;
    if (payload.price !== undefined) payload.price = Number(payload.price) || 0;
    if (payload.amount !== undefined) payload.amount = Number(payload.amount) || 0;

    // Schema sanitization for tables with specific column constraints
    if (tableName === 'suppliers' && payload.balance === undefined) {
      payload.balance = 0;
    }
    if (tableName === 'customers' && payload.balance === undefined) {
      payload.balance = 0;
    }
    if (tableName === 'income') {
      delete payload.created_by;
      if (!payload.type) payload.type = 'Sales';
    }
    if (tableName === 'expenses') {
      if (payload.created_by !== undefined) {
        payload.created_by = isValidUUID(payload.created_by) ? payload.created_by.trim() : null;
      }
      if (!payload.category) payload.category = 'Other';
    }

    const { data, error } = await supabase.from(tableName).insert([payload]).select();
    if (error) {
      console.error(`Supabase INSERT ${tableName} error:`, error.message);
      throw new Error(error.message);
    }
    return data ? data[0] : payload;
  }

  const pathParts = cleanPath.split('/');
  const id = pathParts[pathParts.length - 1];

  if (method === 'PUT' || method === 'PATCH') {
    const payload = await bodyToPayload(body);
    delete payload.id;
    if (payload.cost_price !== undefined) payload.cost_price = Number(payload.cost_price) || 0;
    if (payload.sale_price !== undefined) payload.sale_price = Number(payload.sale_price) || 0;
    if (payload.price !== undefined) payload.price = Number(payload.price) || 0;
    if (payload.amount !== undefined) payload.amount = Number(payload.amount) || 0;

    if (tableName === 'income') {
      delete payload.created_by;
    }
    if (tableName === 'expenses') {
      if (payload.created_by !== undefined) {
        payload.created_by = isValidUUID(payload.created_by) ? payload.created_by.trim() : null;
      }
    }

    let query = supabase.from(tableName).update(payload).eq('id', id);
    if (tenant_id && tableName !== 'tenants') {
      query = query.eq('tenant_id', tenant_id);
    }
    const { data, error } = await query.select();
    if (error) {
      console.error(`Supabase UPDATE ${tableName} error:`, error.message);
      throw new Error(error.message);
    }
    return { message: 'Updated successfully', data: data ? data[0] : null };
  }

  if (method === 'DELETE') {
    let query = supabase.from(tableName).delete().eq('id', id);
    if (tenant_id && tableName !== 'tenants') {
      query = query.eq('tenant_id', tenant_id);
    }
    const { error } = await query;
    if (error) {
      console.error(`Supabase DELETE ${tableName} error:`, error.message);
      throw new Error(error.message);
    }
    return { message: 'Deleted successfully' };
  }
}

// Special Handler for Orders & Order Items in Online SaaS Mode
async function handleOrderOps(method, path, body) {
  const tenant_id = await getTenantId();
  const cleanPath = path.split('?')[0].replace(/^\/api/, '');

  // GET /kitchen/stats
  if (cleanPath === '/kitchen/stats') {
    let query = supabase.from('orders').select('status');
    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    const { data } = await query;
    const stats = { pending: 0, preparing: 0, ready: 0, completed: 0 };
    (data || []).forEach(o => {
      if (stats[o.status] !== undefined) stats[o.status]++;
    });
    return stats;
  }

  // GET /orders or GET /kitchen/orders or GET /kitchen
  if (method === 'GET' && (cleanPath === '/orders' || cleanPath === '/kitchen/orders' || cleanPath === '/kitchen')) {
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    if (cleanPath.includes('kitchen')) {
      query = query.in('status', ['pending', 'preparing', 'ready']);
    }
    const { data: orders, error } = await query;
    if (error) return [];
    if (!orders || orders.length === 0) return [];

    const orderIds = orders.map(o => o.id);
    let itemsQuery = supabase.from('order_items').select('*').in('order_id', orderIds);
    if (tenant_id) itemsQuery = itemsQuery.eq('tenant_id', tenant_id);
    const { data: orderItems } = await itemsQuery;

    const itemsByOrder = {};
    (orderItems || []).forEach(item => {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    });

    return orders.map(o => ({
      ...o,
      items: itemsByOrder[o.id] || []
    }));
  }

  // GET /orders/:id
  if (method === 'GET' && cleanPath.startsWith('/orders/')) {
    const id = cleanPath.replace('/orders/', '');
    let query = supabase.from('orders').select('*').eq('id', id);
    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    const { data: order, error } = await query.maybeSingle();
    if (error || !order) throw new Error('Order not found');

    let itemsQuery = supabase.from('order_items').select('*').eq('order_id', id);
    if (tenant_id) itemsQuery = itemsQuery.eq('tenant_id', tenant_id);
    const { data: items } = await itemsQuery;

    return { ...order, items: items || [] };
  }

  // POST /orders (POS placement)
  if (method === 'POST' && (cleanPath === '/orders' || cleanPath === '/api/orders')) {
    const payload = await bodyToPayload(body);
    const cartItems = Array.isArray(payload.items) ? payload.items : [];
    delete payload.items;

    if (tenant_id && !payload.tenant_id) payload.tenant_id = tenant_id;
    if (!payload.order_number) {
      const today = getTodayString().replace(/-/g, '');
      const randomNum = Math.floor(100 + Math.random() * 900);
      payload.order_number = `ORD-${today}-${randomNum}`;
    }
    if (!payload.created_at) {
      payload.created_at = new Date().toISOString();
    }

    if (payload.subtotal !== undefined) payload.subtotal = Number(payload.subtotal) || 0;
    if (payload.tax !== undefined) payload.tax = Number(payload.tax) || 0;
    if (payload.discount !== undefined) payload.discount = Number(payload.discount) || 0;
    if (payload.total !== undefined) payload.total = Number(payload.total) || 0;

    const { data: newOrder, error: orderErr } = await supabase.from('orders').insert([payload]).select().single();
    if (orderErr) {
      console.error('Supabase INSERT order error:', orderErr.message);
      throw new Error(orderErr.message);
    }

    let insertedItems = [];
    if (cartItems.length > 0) {
      const itemPayloads = cartItems.map(item => {
        const itemCopy = { ...item, order_id: newOrder.id };
        delete itemCopy.id;
        if (tenant_id) itemCopy.tenant_id = tenant_id;
        if (itemCopy.price !== undefined) itemCopy.price = Number(itemCopy.price) || 0;
        if (itemCopy.quantity !== undefined) itemCopy.quantity = Number(itemCopy.quantity) || 1;
        if (itemCopy.total !== undefined) itemCopy.total = Number(itemCopy.total) || (itemCopy.price * itemCopy.quantity);
        return itemCopy;
      });

      const { data: savedItems, error: itemsErr } = await supabase.from('order_items').insert(itemPayloads).select();
      if (itemsErr) {
        console.warn('Supabase INSERT order_items warning:', itemsErr.message);
      } else {
        insertedItems = savedItems || [];
      }
    }

    return { ...newOrder, items: insertedItems.length > 0 ? insertedItems : cartItems };
  }

  // PUT/PATCH /orders/:id
  if ((method === 'PUT' || method === 'PATCH') && cleanPath.startsWith('/orders/')) {
    const id = cleanPath.replace('/orders/', '');
    const payload = await bodyToPayload(body);
    delete payload.id;

    // Extract items before removing from order payload
    const cartItems = Array.isArray(payload.items) ? [...payload.items] : null;
    delete payload.items;

    // Recalculate totals if items provided
    if (cartItems && cartItems.length > 0) {
      let subtotal = 0;
      cartItems.forEach(item => { subtotal += (Number(item.price) || 0) * (Number(item.quantity) || 1); });
      const taxAmt  = Number(payload.tax)      || 0;
      const discAmt = Number(payload.discount)  || 0;
      payload.subtotal = subtotal;
      payload.total    = subtotal + taxAmt - discAmt;
    }

    if (payload.subtotal !== undefined) payload.subtotal = Number(payload.subtotal) || 0;
    if (payload.tax      !== undefined) payload.tax      = Number(payload.tax)      || 0;
    if (payload.discount !== undefined) payload.discount = Number(payload.discount) || 0;
    if (payload.total    !== undefined) payload.total    = Number(payload.total)    || 0;

    let query = supabase.from('orders').update(payload).eq('id', id);
    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    const { data, error } = await query.select();
    if (error) throw new Error(error.message);

    // Replace order items if provided
    if (cartItems && cartItems.length > 0) {
      // Delete old items
      let delQuery = supabase.from('order_items').delete().eq('order_id', id);
      if (tenant_id) delQuery = delQuery.eq('tenant_id', tenant_id);
      await delQuery;

      // Insert new items
      const itemPayloads = cartItems.map(item => {
        const qty   = Number(item.quantity) || 1;
        const price = Number(item.price)    || 0;
        const itemCopy = {
          order_id:             id,
          menu_item_id:         item.menu_item_id || null,
          item_name:            item.item_name || item.name || 'Item',
          quantity:             qty,
          price:                price,
          total:                price * qty,
          special_instructions: item.special_instructions || null,
        };
        if (tenant_id) itemCopy.tenant_id = tenant_id;
        return itemCopy;
      });

      const { error: itemsErr } = await supabase.from('order_items').insert(itemPayloads);
      if (itemsErr) console.warn('Supabase UPDATE order_items warning:', itemsErr.message);
    }

    return { message: 'Order updated', data: data ? data[0] : null };
  }

  return await supabaseTableOp('orders', method, path, body);
}

// Special Handler for Daily Closing in Online SaaS Mode
async function handleDailyClosingOps(method, path, body) {
  const tenant_id = await getTenantId();
  const cleanPath = path.split('?')[0].replace(/^\/api/, '');

  const todayStr = getTodayString();

  // GET /daily-closing/today
  if (cleanPath === '/daily-closing/today') {
    let closingQuery = supabase.from('daily_closing').select('*').order('date', { ascending: false });
    if (tenant_id) closingQuery = closingQuery.eq('tenant_id', tenant_id);
    const { data: allClosings } = await closingQuery;

    const closedDates = new Set((allClosings || []).map(c => c.date));
    const closedRec = (allClosings || []).find(c => c.date === todayStr);
    const latestClosedDate = allClosings?.[0]?.date || '';

    let ordersQuery = supabase.from('orders').select('*');
    if (tenant_id) ordersQuery = ordersQuery.eq('tenant_id', tenant_id);
    const { data: ordersData } = await ordersQuery;

    let incomeOrders = 0;
    let totalOrders = 0;
    let completedOrders = 0;
    let activeOrders = 0;
    let cancelledOrders = 0;
    let cashPay = 0;
    let cardPay = 0;
    let onlinePay = 0;

    (ordersData || []).forEach(o => {
      const orderDate = getOrderDateString(o);
      if (orderDate === todayStr) {
        totalOrders++;
        if (o.status === 'completed' || o.status === 'ready' || o.status === 'preparing') {
          incomeOrders += Number(o.total) || 0;
          if (o.payment_type === 'card') cardPay += Number(o.total) || 0;
          else if (o.payment_type === 'online') onlinePay += Number(o.total) || 0;
          else cashPay += Number(o.total) || 0;
        }
        if (o.status === 'completed') completedOrders++;
        else if (o.status === 'cancelled') cancelledOrders++;
        else activeOrders++;
      }
    });

    let incomeQuery = supabase.from('income').select('*');
    if (tenant_id) incomeQuery = incomeQuery.eq('tenant_id', tenant_id);
    const { data: incomeData } = await incomeQuery;

    let incomeManual = 0;
    (incomeData || []).forEach(i => {
      const iDate = getOrderDateString(i);
      const isToday = iDate === todayStr || i.date === todayStr;
      const isUnclosed = !closedDates.has(iDate) && !closedDates.has(i.date) && (!latestClosedDate || (iDate > latestClosedDate && i.date > latestClosedDate)) && (iDate <= todayStr || i.date <= todayStr);
      if (isToday || isUnclosed) incomeManual += Number(i.amount) || 0;
    });

    let expenseQuery = supabase.from('expenses').select('*');
    if (tenant_id) expenseQuery = expenseQuery.eq('tenant_id', tenant_id);
    const { data: expenseData } = await expenseQuery;

    let totalExpense = 0;
    const catMap = {};

    (expenseData || []).forEach(e => {
      const eDate = getOrderDateString(e) || e.date;
      const isToday = eDate === todayStr || e.date === todayStr;
      const isUnclosed = !closedDates.has(eDate) && !closedDates.has(e.date) && (!latestClosedDate || (eDate > latestClosedDate && e.date > latestClosedDate)) && (eDate <= todayStr || e.date <= todayStr);

      if (isToday || isUnclosed) {
        const amt = Number(e.amount) || 0;
        totalExpense += amt;
        const cat = e.category || 'Other';
        catMap[cat] = (catMap[cat] || 0) + amt;
      }
    });

    const expenseBreakdown = Object.entries(catMap).map(([category, total]) => ({ category, total }));

    const totalIncome = closedRec?.total_income !== undefined ? Number(closedRec.total_income) : (incomeOrders + incomeManual);
    const finalTotalExpense = closedRec?.total_expense !== undefined ? Number(closedRec.total_expense) : totalExpense;
    const netProfit = totalIncome - finalTotalExpense;
    const openingBalance = closedRec?.opening_balance !== undefined ? Number(closedRec.opening_balance) : 0;
    const closingBalance = closedRec?.closing_balance !== undefined ? Number(closedRec.closing_balance) : (openingBalance + netProfit);

    return {
      date: todayStr,
      is_closed: !!closedRec,
      opening_balance: openingBalance,
      income_orders: incomeOrders,
      income_manual: incomeManual,
      total_income: totalIncome,
      total_expense: finalTotalExpense,
      closing_balance: closingBalance,
      net_profit: netProfit,
      expenseBreakdown,
      orders: {
        total_orders: totalOrders,
        completed: completedOrders,
        active: activeOrders,
        cancelled: cancelledOrders
      },
      payments: {
        cash: cashPay,
        card: cardPay,
        online: onlinePay
      }
    };
  }

  // GET /daily-closing/history
  if (cleanPath === '/daily-closing/history') {
    let query = supabase.from('daily_closing').select('*').order('date', { ascending: false });
    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    const { data } = await query;
    return data || [];
  }

  // POST /daily-closing/close or POST /daily-closing
  if (method === 'POST' && (cleanPath === '/daily-closing/close' || cleanPath === '/daily-closing')) {
    const todaySummary = await handleDailyClosingOps('GET', '/daily-closing/today', null);

    let closedBy = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id && isValidUUID(session.user.id)) {
        closedBy = session.user.id;
      }
    } catch {}

    const payload = {
      date: todayStr,
      opening_balance: Number(todaySummary.opening_balance) || 0,
      total_income: Number(todaySummary.total_income) || 0,
      total_expense: Number(todaySummary.total_expense) || 0,
      closing_balance: Number(todaySummary.closing_balance) || 0,
      closed_by: closedBy,
      tenant_id
    };
    const { data, error } = await supabase.from('daily_closing').insert([payload]).select();
    if (error) throw new Error(error.message);
    return data ? data[0] : payload;
  }

  // DELETE /daily-closing/:date (reopen day)
  if (method === 'DELETE' && cleanPath.startsWith('/daily-closing/')) {
    const dateParam = cleanPath.replace('/daily-closing/', '');
    let query = supabase.from('daily_closing').delete().eq('date', dateParam);
    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { message: 'Day reopened' };
  }

  return await supabaseTableOp('daily_closing', method, path, body);
}

// Special Handler for Reports in Online SaaS Mode
async function handleReportOps(method, path) {
  const tenant_id = await getTenantId();
  const cleanPath = path.split('?')[0].replace(/^\/api/, '');

  if (cleanPath === '/reports/sales') {
    let query = supabase.from('orders').select('*');
    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    const { data: orders } = await query;

    let totalSales = 0;
    let totalOrders = 0;
    let dineInTotal = 0;
    let takeawayTotal = 0;
    let deliveryTotal = 0;

    (orders || []).forEach(o => {
      totalOrders++;
      const amt = Number(o.total) || 0;
      totalSales += amt;
      if (o.order_type === 'takeaway') takeawayTotal += amt;
      else if (o.order_type === 'delivery') deliveryTotal += amt;
      else dineInTotal += amt;
    });

    return {
      totalSales,
      totalOrders,
      avgOrderValue: totalOrders > 0 ? (totalSales / totalOrders) : 0,
      dineInTotal,
      takeawayTotal,
      deliveryTotal,
      dailyBreakdown: []
    };
  }

  if (cleanPath === '/reports/profit-loss') {
    let incQuery = supabase.from('income').select('*');
    if (tenant_id) incQuery = incQuery.eq('tenant_id', tenant_id);
    const { data: incomeData } = await incQuery;

    let expQuery = supabase.from('expenses').select('*');
    if (tenant_id) expQuery = expQuery.eq('tenant_id', tenant_id);
    const { data: expenseData } = await expQuery;

    let ordQuery = supabase.from('orders').select('total');
    if (tenant_id) ordQuery = ordQuery.eq('tenant_id', tenant_id);
    const { data: ordersData } = await ordQuery;

    let salesIncome = 0;
    (ordersData || []).forEach(o => { salesIncome += Number(o.total) || 0; });

    let otherIncome = 0;
    (incomeData || []).forEach(i => { otherIncome += Number(i.amount) || 0; });

    let totalExpenses = 0;
    (expenseData || []).forEach(e => { totalExpenses += Number(e.amount) || 0; });

    const totalIncome = salesIncome + otherIncome;
    const netProfit = totalIncome - totalExpenses;

    return {
      totalIncome,
      totalExpenses,
      netProfit,
      salesIncome,
      otherIncome,
      expenseBreakdown: []
    };
  }

  if (cleanPath === '/reports/expenses') {
    let expQuery = supabase.from('expenses').select('*');
    if (tenant_id) expQuery = expQuery.eq('tenant_id', tenant_id);
    const { data: expensesList } = await expQuery;

    let totalExpenses = 0;
    (expensesList || []).forEach(e => { totalExpenses += Number(e.amount) || 0; });

    return {
      totalExpenses,
      count: (expensesList || []).length,
      categoryBreakdown: [],
      expensesList: expensesList || []
    };
  }

  if (cleanPath === '/reports/inventory') {
    let invQuery = supabase.from('inventory').select('*');
    if (tenant_id) invQuery = invQuery.eq('tenant_id', tenant_id);
    const { data: items } = await invQuery;

    let totalValue = 0;
    let lowStockCount = 0;
    (items || []).forEach(item => {
      const qty = Number(item.quantity) || 0;
      const cost = Number(item.cost_per_unit) || 0;
      const minQty = Number(item.min_quantity) || 0;
      totalValue += qty * cost;
      if (qty <= minQty) lowStockCount++;
    });

    return {
      totalItems: (items || []).length,
      lowStockCount,
      totalValue,
      items: items || []
    };
  }

  if (cleanPath === '/reports/customers') {
    let custQuery = supabase.from('customers').select('*');
    if (tenant_id) custQuery = custQuery.eq('tenant_id', tenant_id);
    const { data: customers } = await custQuery;

    return {
      totalCustomers: (customers || []).length,
      topCustomers: customers || []
    };
  }

  return {};
}

// Special Handler for Dashboard in Online SaaS Mode
async function handleDashboardOps() {
  const tenant_id = await getTenantId();

  try {
    let ordersQ = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (tenant_id) ordersQ = ordersQ.eq('tenant_id', tenant_id);

    let itemsQ = supabase.from('order_items').select('*');
    if (tenant_id) itemsQ = itemsQ.eq('tenant_id', tenant_id);

    let menuQ = supabase.from('menu_items').select('*', { count: 'exact', head: true });
    if (tenant_id) menuQ = menuQ.eq('tenant_id', tenant_id);

    let custQ = supabase.from('customers').select('*', { count: 'exact', head: true });
    if (tenant_id) custQ = custQ.eq('tenant_id', tenant_id);

    let profQ = supabase.from('profiles').select('*', { count: 'exact', head: true });
    if (tenant_id) profQ = profQ.eq('tenant_id', tenant_id);

    let invQ = supabase.from('inventory').select('*');
    if (tenant_id) invQ = invQ.eq('tenant_id', tenant_id);

    let incQ = supabase.from('income').select('*');
    if (tenant_id) incQ = incQ.eq('tenant_id', tenant_id);

    let expQ = supabase.from('expenses').select('*');
    if (tenant_id) expQ = expQ.eq('tenant_id', tenant_id);

    const [
      { data: orders },
      { data: orderItems },
      { count: totalMenuItems },
      { count: totalCustomers },
      { count: totalUsers },
      { data: inventoryItems },
      { data: incomeItems },
      { data: expenseItems }
    ] = await Promise.all([
      ordersQ, itemsQ, menuQ, custQ, profQ, invQ, incQ, expQ
    ]);

    const now = new Date();
    const todayStr = getTodayString();
    const currentMonth = todayStr.slice(0, 7);

    const isToday = (o) => {
      return getOrderDateString(o) === todayStr;
    };

    const isThisMonth = (o) => {
      return getOrderDateString(o).startsWith(currentMonth);
    };

    let todaySalesTotal = 0;
    let todaySalesCount = 0;
    let todayOrdersTotal = 0;
    let todayPending = 0;
    let todayPreparing = 0;

    let monthlySalesTotal = 0;
    let monthlySalesCount = 0;

    const paymentMap = {};

    (orders || []).forEach(o => {
      const isT = isToday(o);
      const isM = isThisMonth(o);
      const isValidSale = o.status !== 'cancelled';
      const total = Number(o.total) || 0;

      if (isT) {
        todayOrdersTotal++;
        if (o.status === 'pending') todayPending++;
        if (o.status === 'preparing') todayPreparing++;

        if (isValidSale) {
          todaySalesTotal += total;
          todaySalesCount++;

          const pType = (o.payment_type || 'cash').toLowerCase();
          if (!paymentMap[pType]) paymentMap[pType] = { payment_type: pType, count: 0, total: 0 };
          paymentMap[pType].count++;
          paymentMap[pType].total += total;
        }
      }

      if (isM && isValidSale) {
        monthlySalesTotal += total;
        monthlySalesCount++;
      }
    });

    // Today's Income & Expenses
    let todayIncome = 0;
    (incomeItems || []).forEach(i => {
      const iDate = getOrderDateString(i);
      if (iDate === todayStr || i.date === todayStr) {
        todayIncome += Number(i.amount) || 0;
      }
    });

    let todayExpense = 0;
    (expenseItems || []).forEach(e => {
      const eDate = getOrderDateString(e);
      if (eDate === todayStr || e.date === todayStr) {
        todayExpense += Number(e.amount) || 0;
      }
    });

    const todayProfit = (todaySalesTotal + todayIncome) - todayExpense;

    // Sales Trend (Last 7 Days)
    const salesTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayLocalStr = d.toLocaleDateString('en-CA');
      let dayTotal = 0;
      let dayOrders = 0;

      (orders || []).forEach(o => {
        if (o.status === 'cancelled') return;
        const oDate = getOrderDateString(o);
        if (oDate === dayLocalStr) {
          dayTotal += Number(o.total) || 0;
          dayOrders++;
        }
      });

      salesTrend.push({ date: dayLocalStr, total: dayTotal, orders: dayOrders });
    }

    // Payment breakdown
    const paymentBreakdown = Object.values(paymentMap);

    // Recent Orders (last 8)
    const recentOrders = (orders || []).slice(0, 8).map(o => ({
      id: o.id,
      order_number: o.order_number,
      order_type: o.order_type,
      status: o.status,
      total: Number(o.total) || 0,
      created_at: o.created_at,
      table_number: o.table_number
    }));

    // Top Items (This month)
    const monthOrderIds = new Set(
      (orders || []).filter(o => isThisMonth(o) && o.status !== 'cancelled').map(o => o.id)
    );
    const itemMap = {};
    (orderItems || []).forEach(item => {
      if (monthOrderIds.has(item.order_id)) {
        const name = item.item_name || 'Item';
        if (!itemMap[name]) itemMap[name] = { item_name: name, qty: 0, revenue: 0 };
        itemMap[name].qty += Number(item.quantity) || 1;
        itemMap[name].revenue += Number(item.total) || ((Number(item.price) || 0) * (Number(item.quantity) || 1));
      }
    });
    const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 5);

    // Low Stock Items
    let lowStockCount = 0;
    const lowStockItems = [];
    (inventoryItems || []).forEach(item => {
      const currentStock = Number(item.quantity) || 0;
      const minStock = Number(item.min_quantity || item.low_stock_threshold) || 0;
      if (currentStock <= minStock) {
        lowStockCount++;
        if (lowStockItems.length < 6) {
          lowStockItems.push({
            name: item.name || item.item_name,
            current_stock: currentStock,
            min_stock: minStock,
            unit: item.unit || 'units'
          });
        }
      }
    });

    return {
      todaySales: { total: todaySalesTotal, count: todaySalesCount },
      todayOrders: { total: todayOrdersTotal, pending: todayPending, preparing: todayPreparing },
      todayProfit,
      lowStock: lowStockCount,
      monthlySales: { total: monthlySalesTotal, count: monthlySalesCount },
      totalMenuItems: totalMenuItems || 0,
      totalCustomers: totalCustomers || 0,
      totalUsers: totalUsers || 1,
      salesTrend,
      paymentBreakdown,
      recentOrders,
      topItems,
      lowStockItems,
      todayIncome,
      todayExpense
    };
  } catch (err) {
    console.error('[Supabase Dashboard Error]:', err);
    return {
      todaySales: { total: 0, count: 0 },
      todayOrders: { total: 0, pending: 0, preparing: 0 },
      todayProfit: 0,
      lowStock: 0,
      monthlySales: { total: 0 },
      totalMenuItems: 0,
      totalCustomers: 0,
      totalUsers: 0,
      salesTrend: [],
      paymentBreakdown: [],
      recentOrders: [],
      topItems: [],
      lowStockItems: [],
      todayIncome: 0,
      todayExpense: 0
    };
  }
}

// Special Handler for Profiles / Users with enriched table columns
async function handleUserOps(method, path, body) {
  const tenant_id = await getTenantId();
  const cleanPath = path.split('?')[0].replace(/^\/api/, '');

  if (method === 'GET' && (cleanPath === '/users' || cleanPath === '/api/users')) {
    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    const { data: profiles, error } = await query;
    if (error) return [];

    return (profiles || []).map(p => {
      const emailPrefix = p.email ? p.email.split('@')[0] : '';
      const roleStr = p.role || 'staff';
      return {
        ...p,
        username: p.username || emailPrefix || p.full_name || 'user',
        role_name: roleStr.charAt(0).toUpperCase() + roleStr.slice(1),
        role_id: roleStr,
        is_active: p.is_active !== undefined ? !!p.is_active : true
      };
    });
  }

  if (method === 'PUT' && cleanPath.startsWith('/users/')) {
    const id = cleanPath.replace('/users/', '');
    const payload = await bodyToPayload(body);
    const updateData = {};
    if (payload.full_name !== undefined) updateData.full_name = payload.full_name;
    if (payload.role_id !== undefined) updateData.role = payload.role_id;
    if (payload.role !== undefined) updateData.role = payload.role;

    let query = supabase.from('profiles').update(updateData).eq('id', id);
    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    const { data, error } = await query.select();
    if (error) throw new Error(error.message);
    return data ? data[0] : { success: true };
  }

  return await supabaseTableOp('profiles', method, path, body);
}

// Special Handler for Suppliers & Supplier Ledger / Payments
async function handleSupplierOps(method, path, body) {
  const tenant_id = await getTenantId();
  const cleanPath = path.split('?')[0].replace(/^\/api/, '');

  // GET /suppliers/:id/ledger
  if (method === 'GET' && cleanPath.endsWith('/ledger')) {
    const parts = cleanPath.split('/');
    const supplierId = parts[2];

    let txQuery = supabase.from('supplier_transactions').select('*').eq('supplier_id', supplierId).order('created_at', { ascending: false });
    if (tenant_id) txQuery = txQuery.eq('tenant_id', tenant_id);
    const { data: txns } = await txQuery;

    let sQuery = supabase.from('suppliers').select('*').eq('id', supplierId);
    if (tenant_id) sQuery = sQuery.eq('tenant_id', tenant_id);
    const { data: supplier } = await sQuery.maybeSingle();

    let totalPurchases = 0;
    let totalPayments = 0;
    (txns || []).forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'purchase' || t.type === 'credit') totalPurchases += amt;
      else if (t.type === 'payment' || t.type === 'debit') totalPayments += amt;
    });

    const balance = supplier?.balance !== undefined ? Number(supplier.balance) : (totalPurchases - totalPayments);

    return {
      transactions: txns || [],
      totalPurchases,
      totalPayments,
      balance
    };
  }

  // POST /suppliers/:id/payment
  if (method === 'POST' && cleanPath.endsWith('/payment')) {
    const parts = cleanPath.split('/');
    const supplierId = parts[2];
    const payload = await bodyToPayload(body);
    const paymentAmount = Number(payload.amount) || 0;
    const description = payload.description || 'Payment to supplier';

    // 1. Insert into supplier_transactions
    const txPayload = {
      supplier_id: supplierId,
      type: 'payment',
      amount: paymentAmount,
      description,
      tenant_id
    };
    const { error: txErr } = await supabase.from('supplier_transactions').insert([txPayload]);
    if (txErr) console.warn('Supabase INSERT supplier_transactions warning:', txErr.message);

    // 2. Update suppliers balance
    let sQuery = supabase.from('suppliers').select('balance').eq('id', supplierId);
    if (tenant_id) sQuery = sQuery.eq('tenant_id', tenant_id);
    const { data: sData } = await sQuery.maybeSingle();
    const currentBal = Number(sData?.balance) || 0;
    const newBal = currentBal - paymentAmount;

    let updQuery = supabase.from('suppliers').update({ balance: newBal }).eq('id', supplierId);
    if (tenant_id) updQuery = updQuery.eq('tenant_id', tenant_id);
    await updQuery;

    return { success: true, message: 'Payment recorded', balance: newBal };
  }

  return await supabaseTableOp('suppliers', method, path, body, 'name');
}

// Special Handler for Purchases (with inventory stock and supplier ledger synchronization)
async function handlePurchaseOps(method, path, body) {
  const tenant_id = await getTenantId();
  const cleanPath = path.split('?')[0].replace(/^\/api/, '');

  // GET /purchases
  if (method === 'GET' && (cleanPath === '/purchases' || cleanPath.startsWith('/purchases'))) {
    let query = supabase.from('purchases').select('*').order('created_at', { ascending: false });
    if (tenant_id) query = query.eq('tenant_id', tenant_id);

    const urlParts = path.split('?');
    if (urlParts[1]) {
      const searchParams = new URLSearchParams(urlParts[1]);
      const supId = searchParams.get('supplier_id');
      if (supId) query = query.eq('supplier_id', supId);
    }

    const { data: purchases, error } = await query;
    if (error) return [];
    if (!purchases || purchases.length === 0) return [];

    let sQuery = supabase.from('suppliers').select('id, name');
    if (tenant_id) sQuery = sQuery.eq('tenant_id', tenant_id);
    const { data: suppliers } = await sQuery;

    let iQuery = supabase.from('inventory').select('id, name, unit');
    if (tenant_id) iQuery = iQuery.eq('tenant_id', tenant_id);
    const { data: inventory } = await iQuery;

    const supplierMap = {};
    (suppliers || []).forEach(s => { supplierMap[s.id] = s.name; });

    const itemMap = {};
    (inventory || []).forEach(i => { itemMap[i.id] = i; });

    return purchases.map(p => ({
      ...p,
      supplier_name: supplierMap[p.supplier_id] || '—',
      item_name: itemMap[p.item_id]?.name || '—',
      item_unit: itemMap[p.item_id]?.unit || ''
    }));
  }

  // POST /purchases
  if (method === 'POST' && (cleanPath === '/purchases' || cleanPath === '/api/purchases')) {
    const payload = await bodyToPayload(body);
    const quantity = Number(payload.quantity) || 0;
    const rate = Number(payload.rate) || 0;
    const total = Number(payload.total) || (quantity * rate);

    const purchaseRecord = {
      supplier_id: payload.supplier_id,
      item_id: payload.item_id,
      quantity,
      rate,
      total,
      tenant_id
    };

    const { data: newP, error: pErr } = await supabase.from('purchases').insert([purchaseRecord]).select().single();
    if (pErr) throw new Error(pErr.message);

    // 1. Auto-increment inventory stock
    if (payload.item_id) {
      let invQuery = supabase.from('inventory').select('quantity').eq('id', payload.item_id);
      if (tenant_id) invQuery = invQuery.eq('tenant_id', tenant_id);
      const { data: invItem } = await invQuery.maybeSingle();
      if (invItem) {
        const newQty = (Number(invItem.quantity) || 0) + quantity;
        let updateInv = supabase.from('inventory').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', payload.item_id);
        if (tenant_id) updateInv = updateInv.eq('tenant_id', tenant_id);
        await updateInv;
      }
    }

    // 2. Auto-update supplier balance and log transaction
    if (payload.supplier_id) {
      let supQuery = supabase.from('suppliers').select('balance').eq('id', payload.supplier_id);
      if (tenant_id) supQuery = supQuery.eq('tenant_id', tenant_id);
      const { data: supItem } = await supQuery.maybeSingle();
      if (supItem) {
        const newBal = (Number(supItem.balance) || 0) + total;
        let updateSup = supabase.from('suppliers').update({ balance: newBal }).eq('id', payload.supplier_id);
        if (tenant_id) updateSup = updateSup.eq('tenant_id', tenant_id);
        await updateSup;
      }

      const txRecord = {
        supplier_id: payload.supplier_id,
        type: 'purchase',
        amount: total,
        description: `Purchase: ${quantity} units @ Rs. ${rate}`,
        tenant_id
      };
      await supabase.from('supplier_transactions').insert([txRecord]);
    }

    return newP;
  }

  // DELETE /purchases/:id (Reverses inventory and supplier balance)
  if (method === 'DELETE' && cleanPath.startsWith('/purchases/')) {
    const id = cleanPath.replace('/purchases/', '');
    let getQuery = supabase.from('purchases').select('*').eq('id', id);
    if (tenant_id) getQuery = getQuery.eq('tenant_id', tenant_id);
    const { data: p } = await getQuery.maybeSingle();

    if (p) {
      if (p.item_id) {
        let invQuery = supabase.from('inventory').select('quantity').eq('id', p.item_id);
        if (tenant_id) invQuery = invQuery.eq('tenant_id', tenant_id);
        const { data: invItem } = await invQuery.maybeSingle();
        if (invItem) {
          const revQty = Math.max(0, (Number(invItem.quantity) || 0) - (Number(p.quantity) || 0));
          let updateInv = supabase.from('inventory').update({ quantity: revQty }).eq('id', p.item_id);
          if (tenant_id) updateInv = updateInv.eq('tenant_id', tenant_id);
          await updateInv;
        }
      }

      if (p.supplier_id) {
        let supQuery = supabase.from('suppliers').select('balance').eq('id', p.supplier_id);
        if (tenant_id) supQuery = supQuery.eq('tenant_id', tenant_id);
        const { data: supItem } = await supQuery.maybeSingle();
        if (supItem) {
          const revBal = (Number(supItem.balance) || 0) - (Number(p.total) || 0);
          let updateSup = supabase.from('suppliers').update({ balance: revBal }).eq('id', p.supplier_id);
          if (tenant_id) updateSup = updateSup.eq('tenant_id', tenant_id);
          await updateSup;
        }
      }
    }

    let delQuery = supabase.from('purchases').delete().eq('id', id);
    if (tenant_id) delQuery = delQuery.eq('tenant_id', tenant_id);
    const { error: delErr } = await delQuery;
    if (delErr) throw new Error(delErr.message);

    return { success: true, message: 'Purchase deleted and reversed' };
  }

  return await supabaseTableOp('purchases', method, path, body);
}

// Special Handler for Customers & Customer Details
async function handleCustomerOps(method, path, body) {
  const tenant_id = await getTenantId();
  const cleanPath = path.split('?')[0].replace(/^\/api/, '');

  // GET /customers/:id/orders
  if (method === 'GET' && cleanPath.endsWith('/orders')) {
    const customerId = cleanPath.split('/')[2];
    let query = supabase.from('orders').select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    const { data: orders } = await query;
    return orders || [];
  }

  // GET /customers/:id/transactions
  if (method === 'GET' && cleanPath.endsWith('/transactions')) {
    const customerId = cleanPath.split('/')[2];
    let query = supabase.from('orders').select('id, total, payment_type, created_at, status').eq('customer_id', customerId).order('created_at', { ascending: false });
    if (tenant_id) query = query.eq('tenant_id', tenant_id);
    const { data: orders } = await query;
    return (orders || []).map(o => ({
      id: o.id,
      type: 'credit',
      amount: o.total,
      description: `Order #${o.id.slice(0, 8)} (${o.payment_type})`,
      created_at: o.created_at
    }));
  }

  // POST /customers/:id/transactions
  if (method === 'POST' && cleanPath.endsWith('/transactions')) {
    const customerId = cleanPath.split('/')[2];
    const payload = await bodyToPayload(body);
    const amount = Number(payload.amount) || 0;
    const type = payload.type || 'payment';

    let cQuery = supabase.from('customers').select('balance').eq('id', customerId);
    if (tenant_id) cQuery = cQuery.eq('tenant_id', tenant_id);
    const { data: customer } = await cQuery.maybeSingle();

    if (customer) {
      let newBal = Number(customer.balance) || 0;
      if (type === 'payment') newBal -= amount;
      else if (type === 'credit') newBal += amount;

      let updQuery = supabase.from('customers').update({ balance: newBal }).eq('id', customerId);
      if (tenant_id) updQuery = updQuery.eq('tenant_id', tenant_id);
      await updQuery;
    }

    return { success: true, message: 'Transaction recorded' };
  }

  return await supabaseTableOp('customers', method, path, body, 'name');
}

// Supabase Online Mode Router for Web/SaaS Edition
async function requestSupabase(method, path, body) {
  if (!supabase) return requestHTTP(method, path, body);

  const cleanPath = path.split('?')[0].replace(/^\/api/, '');

  try {
    // Roles
    if (cleanPath === '/roles' || cleanPath === '/users/roles') {
      return [
        { id: 'admin', name: 'Admin' },
        { id: 'manager', name: 'Manager' },
        { id: 'cashier', name: 'Cashier' },
        { id: 'staff', name: 'Staff' }
      ];
    }

    // Users
    if (cleanPath.startsWith('/users')) {
      return await handleUserOps(method, path, body);
    }

    // Menu Categories
    if (cleanPath.startsWith('/menu/categories') || cleanPath.startsWith('/menu-categories') || cleanPath.startsWith('/categories')) {
      return await supabaseTableOp('menu_categories', method, path, body);
    }

    // Menu Items
    if (cleanPath.startsWith('/menu/items') || cleanPath.startsWith('/menu-items') || cleanPath.startsWith('/items')) {
      return await supabaseTableOp('menu_items', method, path, body);
    }

    // Inventory
    if (cleanPath.startsWith('/inventory')) {
      return await supabaseTableOp('inventory', method, path, body);
    }

    // Suppliers
    if (cleanPath.startsWith('/suppliers')) {
      return await handleSupplierOps(method, path, body);
    }

    // Purchases
    if (cleanPath.startsWith('/purchases')) {
      return await handlePurchaseOps(method, path, body);
    }

    // Orders & Kitchen
    if (cleanPath.startsWith('/orders') || cleanPath.startsWith('/kitchen')) {
      return await handleOrderOps(method, path, body);
    }

    // Customers
    if (cleanPath.startsWith('/customers')) {
      return await handleCustomerOps(method, path, body);
    }

    // Expenses
    if (cleanPath.startsWith('/expenses')) {
      return await supabaseTableOp('expenses', method, path, body);
    }

    // Income
    if (cleanPath.startsWith('/income')) {
      return await supabaseTableOp('income', method, path, body);
    }

    // Daily Closing
    if (cleanPath.startsWith('/daily-closing')) {
      return await handleDailyClosingOps(method, path, body);
    }

    // Reports
    if (cleanPath.startsWith('/reports')) {
      return await handleReportOps(method, path);
    }

    // Dashboard Stats
    if (cleanPath === '/dashboard/stats' || cleanPath === '/dashboard' || cleanPath === '/api/dashboard/stats' || cleanPath === '/api/dashboard') {
      return await handleDashboardOps();
    }

    // Fallbacks
    if (cleanPath === '/audit-logs' || cleanPath === '/backups' || cleanPath.startsWith('/backups')) {
      return [];
    }

    if (cleanPath.startsWith('/auth/')) {
      return {};
    }

    try {
      return await requestHTTP(method, path, body);
    } catch (httpErr) {
      console.warn(`[Supabase API Adapter] Fallback HTTP failed for ${method} ${path}:`, httpErr.message);
      if (method === 'GET') {
        if (path.includes('stats')) return {};
        return [];
      }
      return { success: true };
    }
  } catch (err) {
    console.warn(`[Supabase API Adapter] ${method} ${path} error:`, err.message);
    if (method === 'GET') {
      if (path.includes('stats')) return {};
      return [];
    }
    throw err;
  }
}

async function request(method, path, body) {
  if (!isElectron) {
    return requestSupabase(method, path, body);
  }
  return requestHTTP(method, path, body);
}

const api = {
  get:    (path)       => request('GET',    path),
  post:   (path, body) => request('POST',   path, body),
  put:    (path, body) => request('PUT',    path, body),
  patch:  (path, body) => request('PATCH',  path, body),
  delete: (path)       => request('DELETE', path),
};

export default api;
