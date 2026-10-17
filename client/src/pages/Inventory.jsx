import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, Search, AlertTriangle, Package } from 'lucide-react';

const UNITS = ['KG', 'Liter', 'Piece', 'Dozen', 'Pack', 'Gram', 'ML', 'Bottle', 'Box'];

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [form, setForm] = useState({ name: '', quantity: '', unit: 'KG', cost: '', low_stock_threshold: '10' });
  const { profile } = useAuth();

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const items = await api.get('/inventory');
      setItems(items.map(item => ({
        ...item,
        is_low_stock: Number(item.quantity) <= Number(item.low_stock_threshold)
      })));
    } catch (err) { toast.error(err.message); }
  };

  const filtered = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchLow = showLowOnly ? item.is_low_stock : true;
    return matchSearch && matchLow;
  });

  const lowStockCount = items.filter(i => i.is_low_stock).length;

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', quantity: '', unit: 'KG', cost: '', low_stock_threshold: '10' });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name,
      quantity: String(item.quantity),
      unit: item.unit,
      cost: String(item.cost),
      low_stock_threshold: String(item.low_stock_threshold)
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put('/inventory/' + editing.id, form);
        toast.success('Stock item updated');
      } else {
        await api.post('/inventory', { ...form, tenant_id: profile?.tenant_id });
        toast.success('Stock item added');
      }
      setShowModal(false);
      loadItems();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.name}" from inventory?`)) return;
    try {
      await api.delete('/inventory/' + item.id);
      toast.success('Item removed');
      loadItems();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Inventory Management</h1>
          <p className="text-gray-500 text-sm">{items.length} items in stock</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-medium transition">
          <Plus size={18} /> Add Stock Item
        </button>
      </div>

      {/* Low Stock Alert */}
      {lowStockCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertTriangle size={24} className="text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-700">{lowStockCount} item{lowStockCount > 1 ? 's' : ''} low on stock!</p>
            <p className="text-sm text-red-500">These items need to be restocked soon.</p>
          </div>
          <button
            onClick={() => setShowLowOnly(!showLowOnly)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              showLowOnly ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
          >
            {showLowOnly ? 'Show All' : 'Show Low Stock'}
          </button>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search inventory..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Item</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Quantity</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Unit</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Cost</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(item => (
                <tr key={item.id} className={`hover:bg-gray-50 ${item.is_low_stock ? 'bg-red-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.is_low_stock ? 'bg-red-100' : 'bg-blue-100'}`}>
                        <Package size={18} className={item.is_low_stock ? 'text-red-500' : 'text-blue-600'} />
                      </div>
                      <span className="font-medium text-gray-800">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-lg font-semibold ${item.is_low_stock ? 'text-red-600' : 'text-gray-800'}`}>
                      {item.quantity}
                    </span>
                    <span className="text-gray-400 text-sm ml-1">/ {item.low_stock_threshold} min</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg text-xs font-medium">
                      {item.unit}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700">Rs. {item.cost}</td>
                  <td className="px-6 py-4">
                    {item.is_low_stock ? (
                      <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                        <AlertTriangle size={14} /> Low Stock
                      </span>
                    ) : (
                      <span className="text-green-600 text-sm font-medium">In Stock</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50 mr-1">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(item)} className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <Package size={32} className="mx-auto mb-2 opacity-50" />
                    {search || showLowOnly ? 'No matching items' : 'No inventory items yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-semibold">{editing ? 'Edit Stock Item' : 'Add Stock Item'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="e.g., Chicken, Rice, Oil"
                  required autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={form.quantity}
                    onChange={e => setForm({...form, quantity: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={form.unit}
                    onChange={e => setForm({...form, unit: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost (Rs.)</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={form.cost}
                    onChange={e => setForm({...form, cost: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Alert</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={form.low_stock_threshold}
                    onChange={e => setForm({...form, low_stock_threshold: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    placeholder="10"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-medium">
                  {editing ? 'Update' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
