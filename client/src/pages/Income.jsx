import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, X, TrendingUp } from 'lucide-react';

const TYPE_COLORS = {
  Sales: 'bg-green-100 text-green-700', 'Delivery Charges': 'bg-blue-100 text-blue-700',
  Tips: 'bg-yellow-100 text-yellow-700', Catering: 'bg-purple-100 text-purple-700', Other: 'bg-gray-100 text-gray-700',
};

export default function Income() {
  const [incomeList, setIncomeList] = useState([]);
  const [summary, setSummary] = useState({ today: 0, month: 0, byType: [] });
  const [types, setTypes] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), type: 'Sales', amount: '', description: '' });

  useEffect(() => {
    api.get('/income/types').then(setTypes).catch(() => {});
    loadSummary();
  }, []);

  useEffect(() => { loadIncome(); }, [filterType, dateFrom, dateTo]);

  const loadIncome = async () => {
    try {
      let url = '/income?';
      if (filterType) url += `type=${encodeURIComponent(filterType)}&`;
      if (dateFrom) url += `date_from=${dateFrom}&`;
      if (dateTo) url += `date_to=${dateTo}`;
      setIncomeList(await api.get(url));
    } catch (err) { toast.error(err.message); }
  };

  const loadSummary = async () => {
    try { setSummary(await api.get('/income/summary')); } catch {}
  };

  const openForm = (income = null) => {
    if (income) {
      setEditing(income);
      setForm({ date: income.date, type: income.type, amount: String(income.amount), description: income.description || '' });
    } else {
      setEditing(null);
      setForm({ date: new Date().toISOString().slice(0, 10), type: 'Sales', amount: '', description: '' });
    }
    setShowForm(true);
  };

  const save = async () => {
    if (!form.type || !form.amount) return toast.error('Type and amount required');
    try {
      if (editing) {
        await api.put(`/income/${editing.id}`, form);
        toast.success('Income updated');
      } else {
        await api.post('/income', form);
        toast.success('Income recorded');
      }
      setShowForm(false);
      loadIncome();
      loadSummary();
    } catch (err) { toast.error(err.message); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this income entry?')) return;
    try {
      await api.delete(`/income/${id}`);
      toast.success('Deleted');
      loadIncome();
      loadSummary();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Income</h1>
          <p className="text-gray-500 text-sm">{incomeList.length} entries</p>
        </div>
        <button onClick={() => openForm()} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition">
          <Plus size={18} /> Add Income
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Today's Income</p>
          <p className="text-2xl font-bold text-green-600">Rs. {summary.today?.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">This Month</p>
          <p className="text-2xl font-bold text-green-600">Rs. {summary.month?.toFixed(2)}</p>
        </div>
        {summary.byType?.slice(0, 2).map(t => (
          <div key={t.type} className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">Top: {t.type}</p>
            <p className="text-2xl font-bold text-gray-800">Rs. {t.total?.toFixed(2)}</p>
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
          <label className="text-xs text-gray-500 mb-1 block">Type</label>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-orange-500 outline-none">
            <option value="">All</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {(dateFrom || dateTo || filterType) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setFilterType(''); }} className="text-sm text-red-500 hover:text-red-700 underline">Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Order #</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {incomeList.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">{i.date}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${TYPE_COLORS[i.type] || TYPE_COLORS.Other}`}>{i.type}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-800">{i.description || '—'}</td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">{i.order_number || '—'}</td>
                  <td className="px-6 py-4 text-right font-semibold text-green-600">Rs. {i.amount?.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openForm(i)} className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50"><Edit2 size={16} /></button>
                    <button onClick={() => remove(i.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 ml-1"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {incomeList.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400"><TrendingUp size={32} className="mx-auto mb-2 opacity-50" />No income found</td></tr>
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
              <h3 className="text-lg font-bold">{editing ? 'Edit Income' : 'Add Income'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none">
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.) *</label>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none" placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Optional note" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-xl border hover:bg-gray-50 font-medium transition">Cancel</button>
              <button onClick={save} className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-semibold transition">
                {editing ? 'Update' : 'Add Income'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
