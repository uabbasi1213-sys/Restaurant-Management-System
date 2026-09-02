import { supabase } from '../supabase';

const isElectron = import.meta.env.VITE_MODE === 'electron';
const BASE_URL = isElectron
  ? (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api'
  : (import.meta.env.VITE_API_URL || '/api');

function getToken() {
  return localStorage.getItem('desktop_token') || localStorage.getItem('token') || '';
}

async function getTenantId() {
  const stored = localStorage.getItem('tenant_id');
  if (stored) return stored;
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: prof } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).maybeSingle();
        if (prof?.tenant_id) {
          localStorage.setItem('tenant_id', prof.tenant_id);
          return prof.tenant_id;
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function bodyToPayload(body) {
  if (!body) return {};
  if (body instanceof FormData) {
    const payload = {};
    for (const [key, value] of body.entries()) {
      if (!(value instanceof File)) {
        payload[key] = value;
      }
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
  const cleanPath = path.split('?')[0];

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
    const payload = bodyToPayload(body);
    if (tenant_id && !payload.tenant_id && tableName !== 'tenants') {
      payload.tenant_id = tenant_id;
    }
    if (payload.cost_price !== undefined) payload.cost_price = Number(payload.cost_price) || 0;
    if (payload.sale_price !== undefined) payload.sale_price = Number(payload.sale_price) || 0;
    if (payload.price !== undefined) payload.price = Number(payload.price) || 0;
    if (payload.amount !== undefined) payload.amount = Number(payload.amount) || 0;

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
    const payload = bodyToPayload(body);
    delete payload.id;
    if (payload.cost_price !== undefined) payload.cost_price = Number(payload.cost_price) || 0;
    if (payload.sale_price !== undefined) payload.sale_price = Number(payload.sale_price) || 0;
    if (payload.price !== undefined) payload.price = Number(payload.price) || 0;
    if (payload.amount !== undefined) payload.amount = Number(payload.amount) || 0;

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

// Supabase Online Mode Router for Web/SaaS Edition
async function requestSupabase(method, path, body) {
  if (!supabase) return requestHTTP(method, path, body);

  const cleanPath = path.split('?')[0];

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
      return await supabaseTableOp('profiles', method, path, body);
    }

    // Menu Categories
    if (cleanPath.startsWith('/menu/categories')) {
      return await supabaseTableOp('menu_categories', method, path, body);
    }

    // Menu Items
    if (cleanPath.startsWith('/menu/items')) {
      return await supabaseTableOp('menu_items', method, path, body);
    }

    // Inventory
    if (cleanPath.startsWith('/inventory')) {
      return await supabaseTableOp('inventory', method, path, body);
    }

    // Suppliers
    if (cleanPath.startsWith('/suppliers')) {
      return await supabaseTableOp('suppliers', method, path, body);
    }

    // Purchases
    if (cleanPath.startsWith('/purchases')) {
      return await supabaseTableOp('purchases', method, path, body);
    }

    // Orders & Kitchen
    if (cleanPath.startsWith('/orders') || cleanPath.startsWith('/kitchen')) {
      return await supabaseTableOp('orders', method, path, body);
    }

    // Customers
    if (cleanPath.startsWith('/customers')) {
      return await supabaseTableOp('customers', method, path, body);
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
      return await supabaseTableOp('daily_closings', method, path, body);
    }

    // Dashboard Stats
    if (cleanPath === '/dashboard/stats') {
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

    // Fallbacks
    if (cleanPath === '/audit-logs' || cleanPath === '/backups') {
      return [];
    }

    return await requestHTTP(method, path, body);
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
