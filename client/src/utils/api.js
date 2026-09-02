import { supabase } from '../supabase';

const isElectron = import.meta.env.VITE_MODE === 'electron';
const BASE_URL = isElectron
  ? (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api'
  : (import.meta.env.VITE_API_URL || '/api');

function getToken() {
  return localStorage.getItem('desktop_token') || localStorage.getItem('token') || '';
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

// Supabase Online Mode Router for Web/SaaS Edition
async function requestSupabase(method, path, body) {
  if (!supabase) return requestHTTP(method, path, body);

  const cleanPath = path.split('?')[0];

  try {
    // Users & Roles
    if (cleanPath === '/users' || cleanPath === '/api/users') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return (data || []).map(u => ({ ...u, username: u.email || u.full_name, role_name: u.role || 'Staff' }));
      }
      if (method === 'POST') {
        const { data, error } = await supabase.from('profiles').insert([body]).select();
        if (error) throw new Error(error.message);
        return data[0];
      }
    }
    if (cleanPath === '/roles' || cleanPath === '/users/roles') {
      return [
        { id: 'admin', name: 'Admin' },
        { id: 'manager', name: 'Manager' },
        { id: 'cashier', name: 'Cashier' },
        { id: 'staff', name: 'Staff' }
      ];
    }
    if (cleanPath.startsWith('/users/')) {
      const id = cleanPath.replace('/users/', '');
      if (method === 'PUT' || method === 'PATCH') {
        const { error } = await supabase.from('profiles').update(body).eq('id', id);
        if (error) throw new Error(error.message);
        return { message: 'User updated' };
      }
      if (method === 'DELETE') {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return { message: 'User deleted' };
      }
    }

    // Menu Categories
    if (cleanPath === '/menu/categories') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('menu_categories').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
      }
      if (method === 'POST') {
        const { data, error } = await supabase.from('menu_categories').insert([body]).select();
        if (error) throw new Error(error.message);
        return data[0];
      }
    }
    if (cleanPath.startsWith('/menu/categories/')) {
      const id = cleanPath.replace('/menu/categories/', '');
      if (method === 'PUT' || method === 'PATCH') {
        const { error } = await supabase.from('menu_categories').update(body).eq('id', id);
        if (error) throw new Error(error.message);
        return { message: 'Category updated' };
      }
      if (method === 'DELETE') {
        const { error } = await supabase.from('menu_categories').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return { message: 'Category deleted' };
      }
    }

    // Menu Items
    if (cleanPath === '/menu/items') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('menu_items').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
      }
      if (method === 'POST') {
        const { data, error } = await supabase.from('menu_items').insert([body]).select();
        if (error) throw new Error(error.message);
        return data[0];
      }
    }
    if (cleanPath.startsWith('/menu/items/')) {
      const id = cleanPath.replace('/menu/items/', '');
      if (method === 'PUT' || method === 'PATCH') {
        const { error } = await supabase.from('menu_items').update(body).eq('id', id);
        if (error) throw new Error(error.message);
        return { message: 'Item updated' };
      }
      if (method === 'DELETE') {
        const { error } = await supabase.from('menu_items').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return { message: 'Item deleted' };
      }
    }

    // Inventory
    if (cleanPath === '/inventory') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('inventory').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
      }
      if (method === 'POST') {
        const { data, error } = await supabase.from('inventory').insert([body]).select();
        if (error) throw new Error(error.message);
        return data[0];
      }
    }
    if (cleanPath.startsWith('/inventory/')) {
      const id = cleanPath.replace('/inventory/', '');
      if (method === 'PUT' || method === 'PATCH') {
        const { error } = await supabase.from('inventory').update(body).eq('id', id);
        if (error) throw new Error(error.message);
        return { message: 'Inventory updated' };
      }
      if (method === 'DELETE') {
        const { error } = await supabase.from('inventory').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return { message: 'Inventory deleted' };
      }
    }

    // Suppliers
    if (cleanPath === '/suppliers') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('suppliers').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
      }
      if (method === 'POST') {
        const { data, error } = await supabase.from('suppliers').insert([body]).select();
        if (error) throw new Error(error.message);
        return data[0];
      }
    }
    if (cleanPath.startsWith('/suppliers/')) {
      const id = cleanPath.replace('/suppliers/', '');
      if (method === 'PUT' || method === 'PATCH') {
        const { error } = await supabase.from('suppliers').update(body).eq('id', id);
        if (error) throw new Error(error.message);
        return { message: 'Supplier updated' };
      }
      if (method === 'DELETE') {
        const { error } = await supabase.from('suppliers').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return { message: 'Supplier deleted' };
      }
    }

    // Purchases
    if (cleanPath === '/purchases') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('purchases').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
      }
      if (method === 'POST') {
        const { data, error } = await supabase.from('purchases').insert([body]).select();
        if (error) throw new Error(error.message);
        return data[0];
      }
    }

    // Orders & Kitchen
    if (cleanPath === '/orders' || cleanPath === '/kitchen') {
      if (method === 'GET') {
        let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (cleanPath === '/kitchen') query = query.in('status', ['pending', 'preparing', 'ready']);
        const { data, error } = await query;
        if (error) return [];
        return data || [];
      }
      if (method === 'POST') {
        const { data, error } = await supabase.from('orders').insert([body]).select();
        if (error) throw new Error(error.message);
        return data[0];
      }
    }
    if (cleanPath.startsWith('/orders/')) {
      const id = cleanPath.replace('/orders/', '');
      if (method === 'PUT' || method === 'PATCH') {
        const { error } = await supabase.from('orders').update(body).eq('id', id);
        if (error) throw new Error(error.message);
        return { message: 'Order updated' };
      }
    }

    // Customers
    if (cleanPath === '/customers') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
      }
      if (method === 'POST') {
        const { data, error } = await supabase.from('customers').insert([body]).select();
        if (error) throw new Error(error.message);
        return data[0];
      }
    }
    if (cleanPath.startsWith('/customers/')) {
      const id = cleanPath.replace('/customers/', '');
      if (method === 'PUT' || method === 'PATCH') {
        const { error } = await supabase.from('customers').update(body).eq('id', id);
        if (error) throw new Error(error.message);
        return { message: 'Customer updated' };
      }
      if (method === 'DELETE') {
        const { error } = await supabase.from('customers').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return { message: 'Customer deleted' };
      }
    }

    // Expenses & Income
    if (cleanPath === '/expenses') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
      }
      if (method === 'POST') {
        const { data, error } = await supabase.from('expenses').insert([body]).select();
        if (error) throw new Error(error.message);
        return data[0];
      }
    }
    if (cleanPath === '/income') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('income').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
      }
      if (method === 'POST') {
        const { data, error } = await supabase.from('income').insert([body]).select();
        if (error) throw new Error(error.message);
        return data[0];
      }
    }

    // Daily Closing
    if (cleanPath === '/daily-closing') {
      if (method === 'GET') {
        const { data, error } = await supabase.from('daily_closings').select('*').order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
      }
      if (method === 'POST') {
        const { data, error } = await supabase.from('daily_closings').insert([body]).select();
        if (error) throw new Error(error.message);
        return data[0];
      }
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

    // Fallbacks for audit-logs, backups, etc.
    if (cleanPath === '/audit-logs' || cleanPath === '/backups') {
      return [];
    }

    // Fallback try HTTP request if endpoint not matched above
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
