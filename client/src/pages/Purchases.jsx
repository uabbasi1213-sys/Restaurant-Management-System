import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, ShoppingCart, Filter } from 'lucide-react';

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [filterSupplier, setFilterSupplier] = useState('');
  const [form, setForm] = useState({ supplier_id: '', item_id: '', quantity: '', rate: '' });

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadPurchases(); }, [filterSupplier]);

  const loadAll = async () => {
    try {
      const [s, i] = await Promise.all([
        api.get('/suppliers'),
        api.get('/inventory')
      ]);
      setSuppliers(s);
      setInventory(i);
    } catch (err) { toast.error(err.message); }
  };

  const loadPurchases = async () => {
    try {
      let url = '/purchases?';
      if (filterSupplier) url += `supplier_id=${filterSupplier}`;
      const data = await api.get(url);
      setPurchases(data);
    } catch (err) { toast.error(err.message); }
  };

  const openAdd = () => {
    setForm({
      supplier_id: suppliers[0]?.id || '',
      item_id: inventory[0]?.id || '',
      quantity: '',
      rate: ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/purchases', form);
      toast.success('Purchase recorded! Inventory & supplier ledger updated automatically.');
      setShowModal(false);
      loadPurchases();
      // Refresh inventory for updated quantities
      const i = await api.get('/inventory');
      setInventory(i);
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (p) => {
    if (!confirm(`Delete this purchase? Inventory and supplier ledger will be reversed.`)) return;
    try {
      await api.delete(`/purchases/${p.id}`);
      toast.success('Purchase deleted & reversed');
      loadPurchases();
      const i = await api.get('/inventory');
      setInventory(i);
    } catch (err) { toast.error(err.message); }
  };

  const calcTotal = () => {
    const q = parseFloat(form.quantity) || 0;
    const r = parseFloat(form.rate) || 0;
    return (q * r).toFixed(2);
  };

  const grandTotal = purchases.reduce((sum, p) => sum + (p.total || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Purchase Module</h1>
          <p className="text-gray-500 text-sm">{purchases.length} purchases — Total: Rs. {grandTotal.toFixed(2)}</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-medium transition">
          <Plus size={18} /> New Purchase
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex items-center gap-3">
          <Filter size={18} className="text-gray-400" />
          <select
            value={filterSupplier}
            onChange={e => setFilterSupplier(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
          >
            <option value="">All Suppliers</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Item</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Rate</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {purchases.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-800">{p.supplier_name || '—'}</td>
                  <td className="px-6 py-4">
                    <span className="text-gray-800">{p.item_name || '—'}</span>
                    {p.item_unit && <span className="text-gray-400 text-xs ml-1">({p.item_unit})</span>}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-700">{p.quantity}</td>
                  <td className="px-6 py-4 text-right text-gray-700">Rs. {p.rate?.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-800">Rs. {p.total?.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(p)} className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <ShoppingCart size={32} className="mx-auto mb-2 opacity-50" />
                    No purchases yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Purchase Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-semibold">New Purchase</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
                <select
                  value={form.supplier_id}
                  onChange={e => setForm({...form, supplier_id: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  required
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.company ? ` (${s.company})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item *</label>
                <select
                  value={form.item_id}
                  onChange={e => setForm({...form, item_id: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  required
                >
                  <option value="">Select Item</option>
                  {inventory.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.unit}) — Stock: {i.quantity}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={form.quantity}
                    onChange={e => setForm({...form, quantity: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    placeholder="0" required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate (Rs.) *</label>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={form.rate}
                    onChange={e => setForm({...form, rate: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    placeholder="0" required
                  />
                </div>
              </div>

              {/* Auto Total */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                <p className="text-sm text-orange-600">Total Amount</p>
                <p className="text-2xl font-bold text-orange-700">Rs. {calcTotal()}</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                <p className="font-medium mb-1">Auto Actions:</p>
                <p>• Inventory stock will increase automatically</p>
                <p>• Supplier ledger will be updated</p>
                <p>• Supplier balance will recalculate</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-medium">
                  Record Purchase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
