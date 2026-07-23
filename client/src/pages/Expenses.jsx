import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Search, X, TrendingDown, Calendar, Filter } from 'lucide-react';

const CAT_COLORS = {
  Rent: 'bg-purple-100 text-purple-700', Utilities: 'bg-blue-100 text-blue-700', Salaries: 'bg-green-100 text-green-700',
  Ingredients: 'bg-orange-100 text-orange-700', Maintenance: 'bg-yellow-100 text-yellow-700', Marketing: 'bg-pink-100 text-pink-700',
  Transport: 'bg-cyan-100 text-cyan-700', Equipment: 'bg-indigo-100 text-indigo-700', Cleaning: 'bg-teal-100 text-teal-700',
  Other: 'bg-gray-100 text-gray-700',
};

export default function Expenses() {
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ today: 0, month: 0, byCategory: [] });
  const [categories, setCategories] = useState([]);
  const [filterCat, setFilterCat] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), description: '', amount: '', category: 'Other' });

  useEffect(() => {
    if (profile) {
      setCategories(['Rent', 'Utilities', 'Salaries', 'Ingredients', 'Maintenance', 'Marketing', 'Transport', 'Equipment', 'Cleaning', 'Other']);
      loadSummary();
    }
  }, [profile]);

  useEffect(() => { if (profile) loadExpenses(); }, [filterCat, dateFrom, dateTo, profile]);

  const loadExpenses = async () => {
    try {
      let query = supabase.from('expenses').select(`
        *,
        profiles(full_name)
      `).eq('tenant_id', profile.tenant_id).order('date', { ascending: false });
      
      if (filterCat) query = query.eq('category', filterCat);
      if (dateFrom) query = query.gte('date', dateFrom);
      if (dateTo) query = query.lte('date', dateTo);
      
      const { data, error } = await query;
      if (error) {
        // Fallback: load without join if FK doesn't exist
        let q2 = supabase.from('expenses').select('*').eq('tenant_id', profile.tenant_id).order('date', { ascending: false });
        if (filterCat) q2 = q2.eq('category', filterCat);
        if (dateFrom) q2 = q2.gte('date', dateFrom);
        if (dateTo) q2 = q2.lte('date', dateTo);
        const { data: d2, error: e2 } = await q2;
        if (e2) { toast.error(e2.message); return; }
        setExpenses(d2 || []);
        return;
      }
      
      const mapped = (data || []).map(e => ({
        ...e,
        created_by_name: e.profiles?.full_name
      }));
      setExpenses(mapped);
    } catch (err) { toast.error(err.message); }
  };

  const loadSummary = async () => {
    try {
      const { data, error } = await supabase.from('expenses').select('*').eq('tenant_id', profile.tenant_id);
      if (error) { toast.error(error.message); return; }
      
      const today = new Date().toISOString().slice(0,10);
      const thisMonth = today.slice(0,7);
      
      let sumToday = 0;
      let sumMonth = 0;
      const catTotals = {};

      data.forEach(e => {
        if (e.date === today) sumToday += e.amount;
        if (e.date.startsWith(thisMonth)) sumMonth += e.amount;
        catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
      });

      const byCategory = Object.entries(catTotals)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);

      setSummary({ today: sumToday, month: sumMonth, byCategory });
    } catch (err) {}
  };

  const openForm = (expense = null) => {
    if (expense) {
      setEditing(expense);
      setForm({ date: expense.date, description: expense.description, amount: String(expense.amount), category: expense.category });
    } else {
      setEditing(null);
      setForm({ date: new Date().toISOString().slice(0, 10), description: '', amount: '', category: 'Other' });
    }
    setShowForm(true);
  };

  const save = async () => {
    if (!form.description.trim() || !form.amount) return toast.error('Description and amount required');
    try {
      const payload = { ...form, amount: parseFloat(form.amount), tenant_id: profile.tenant_id };
      if (!editing) payload.created_by = profile.id;

      if (editing) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', editing.id).eq('tenant_id', profile.tenant_id);
        if (error) { toast.error(error.message); return; }
        toast.success('Expense updated');
      } else {
        const { error } = await supabase.from('expenses').insert([payload]);
        if (error) { toast.error(error.message); return; }
        toast.success('Expense added');
      }
      setShowForm(false);
      loadExpenses();
      loadSummary();
    } catch (err) { toast.error(err.message); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this expense?')) return;
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id).eq('tenant_id', profile.tenant_id);
      if (error) { toast.error(error.message); return; }
      toast.success('Deleted');
      loadExpenses();
      loadSummary();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Expenses</h1>
          <p className="text-gray-500 text-sm">{expenses.length} entries</p>
        </div>
        <button onClick={() => openForm()} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition">
          <Plus size={18} /> Add Expense
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Today's Expenses</p>
          <p className="text-2xl font-bold text-red-600">Rs. {summary.today?.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">This Month</p>
          <p className="text-2xl font-bold text-red-600">Rs. {summary.month?.toFixed(2)}</p>
        </div>
        {summary.byCategory?.slice(0, 2).map(c => (
          <div key={c.category} className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">Top: {c.category}</p>
            <p className="text-2xl font-bold text-gray-800">Rs. {c.total?.toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Category</label>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-orange-500 outline-none">
            <option value="">All</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {(dateFrom || dateTo || filterCat) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setFilterCat(''); }} className="text-sm text-red-500 hover:text-red-700 underline">Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">By</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {expenses.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">{e.date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{e.description}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${CAT_COLORS[e.category] || CAT_COLORS.Other}`}>{e.category}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-red-600">Rs. {e.amount?.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{e.created_by_name || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openForm(e)} className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50"><Edit2 size={16} /></button>
                    <button onClick={() => remove(e.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 ml-1"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400"><TrendingDown size={32} className="mx-auto mb-2 opacity-50" />No expenses found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold">{editing ? 'Edit Expense' : 'Add Expense'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Expense description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.) *</label>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none">
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-xl border hover:bg-gray-50 font-medium transition">Cancel</button>
              <button onClick={save} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-semibold transition">
                {editing ? 'Update' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
