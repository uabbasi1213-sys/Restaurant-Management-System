import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { UserPlus, Edit2, Trash2, Search, X, Eye, CreditCard, Wallet, Phone, MapPin, Receipt } from 'lucide-react';

const TXN_COLORS = {
  credit: 'text-red-600 bg-red-50',
  payment: 'text-green-600 bg-green-50',
  refund: 'text-blue-600 bg-blue-50',
};

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showTxnForm, setShowTxnForm] = useState(false);
  const [txnForm, setTxnForm] = useState({ type: 'payment', amount: '', description: '' });

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    try {
      const data = await api.get(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      setCustomers(data);
    } catch (err) { toast.error(err.message); }
  };

  useEffect(() => {
    const timer = setTimeout(loadCustomers, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const openForm = (customer = null) => {
    if (customer) {
      setEditing(customer);
      setForm({ name: customer.name, phone: customer.phone || '', address: customer.address || '' });
    } else {
      setEditing(null);
      setForm({ name: '', phone: '', address: '' });
    }
    setShowForm(true);
  };

  const saveCustomer = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    try {
      if (editing) {
        await api.put(`/customers/${editing.id}`, form);
        toast.success('Customer updated');
      } else {
        await api.post('/customers', form);
        toast.success('Customer added');
      }
      setShowForm(false);
      loadCustomers();
    } catch (err) { toast.error(err.message); }
  };

  const deleteCustomer = async (id) => {
    if (!confirm('Delete this customer?')) return;
    try {
      await api.delete(`/customers/${id}`);
      toast.success('Customer deleted');
      loadCustomers();
    } catch (err) { toast.error(err.message); }
  };

  const viewCustomer = async (customer) => {
    try {
      const data = await api.get(`/customers/${customer.id}`);
      setSelectedCustomer(data);
    } catch (err) { toast.error(err.message); }
  };

  const openTxnForm = () => {
    setTxnForm({ type: 'payment', amount: '', description: '' });
    setShowTxnForm(true);
  };

  const saveTxn = async () => {
    if (!txnForm.amount || parseFloat(txnForm.amount) <= 0) return toast.error('Valid amount required');
    try {
      await api.post(`/customers/${selectedCustomer.id}/transactions`, txnForm);
      toast.success('Transaction recorded');
      setShowTxnForm(false);
      // Refresh customer detail
      const data = await api.get(`/customers/${selectedCustomer.id}`);
      setSelectedCustomer(data);
      loadCustomers();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
          <p className="text-gray-500 text-sm">{customers.length} customers</p>
        </div>
        <button onClick={() => openForm()} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition">
          <UserPlus size={18} /> Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Address</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Balance</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Orders</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Total Spent</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-semibold text-gray-800">{c.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.phone || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate">{c.address || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-semibold ${c.balance > 0 ? 'text-red-600' : c.balance < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                      Rs. {Math.abs(c.balance || 0).toFixed(2)}
                      {c.balance > 0 ? ' (owes)' : c.balance < 0 ? ' (advance)' : ''}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-600">{c.total_orders || 0}</td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Rs. {(c.total_spent || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => viewCustomer(c)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title="View"><Eye size={16} /></button>
                      <button onClick={() => openForm(c)} className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50" title="Edit"><Edit2 size={16} /></button>
                      <button onClick={() => deleteCustomer(c.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No customers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold">{editing ? 'Edit Customer' : 'Add Customer'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Customer name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none" placeholder="03XX-XXXXXXX" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
                  <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none" rows={2} placeholder="Address" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-xl border hover:bg-gray-50 font-medium transition">Cancel</button>
              <button onClick={saveCustomer} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-semibold transition">
                {editing ? 'Update' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="text-lg font-bold">{selectedCustomer.name}</h3>
                <p className="text-sm text-gray-500">
                  {selectedCustomer.phone && <span className="mr-3">📞 {selectedCustomer.phone}</span>}
                  {selectedCustomer.address && <span>📍 {selectedCustomer.address}</span>}
                </p>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {/* Balance & Stats */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Balance</p>
                  <p className={`text-xl font-bold ${selectedCustomer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    Rs. {Math.abs(selectedCustomer.balance || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">{selectedCustomer.balance > 0 ? 'Outstanding' : selectedCustomer.balance < 0 ? 'Advance' : 'Clear'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Total Orders</p>
                  <p className="text-xl font-bold text-gray-800">{selectedCustomer.orders?.length || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Add Transaction</p>
                  <button onClick={openTxnForm} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition">
                    + Payment
                  </button>
                </div>
              </div>

              {/* Transactions */}
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Wallet size={16} /> Transactions</h4>
              {selectedCustomer.transactions?.length > 0 ? (
                <div className="space-y-2 mb-6">
                  {selectedCustomer.transactions.map(txn => (
                    <div key={txn.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${TXN_COLORS[txn.type] || 'bg-gray-100 text-gray-600'}`}>
                          {txn.type}
                        </span>
                        <span className="text-sm text-gray-600">{txn.description || '—'}</span>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold text-sm ${txn.type === 'credit' ? 'text-red-600' : 'text-green-600'}`}>
                          {txn.type === 'credit' ? '+' : '-'}Rs. {txn.amount?.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400">{new Date(txn.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 mb-6">No transactions yet</p>
              )}

              {/* Recent Orders */}
              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Receipt size={16} /> Recent Orders</h4>
              {selectedCustomer.orders?.length > 0 ? (
                <div className="space-y-2">
                  {selectedCustomer.orders.map(order => (
                    <div key={order.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div>
                        <p className="font-mono font-semibold text-sm text-gray-800">{order.order_number}</p>
                        <p className="text-xs text-gray-500 capitalize">{order.order_type} • {order.status}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">Rs. {order.total?.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No orders yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transaction Form Modal */}
      {showTxnForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold">Add Transaction</h3>
              <button onClick={() => setShowTxnForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  {['payment', 'credit', 'refund'].map(t => (
                    <button key={t} onClick={() => setTxnForm({ ...txnForm, type: t })}
                      className={`flex-1 py-2 rounded-md text-sm font-medium transition capitalize ${
                        txnForm.type === t ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
                      }`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.) *</label>
                <input type="number" min="0" step="0.01" value={txnForm.amount} onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={txnForm.description} onChange={e => setTxnForm({ ...txnForm, description: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Payment note..." />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowTxnForm(false)} className="flex-1 px-4 py-2.5 rounded-xl border hover:bg-gray-50 font-medium transition">Cancel</button>
              <button onClick={saveTxn} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-semibold transition">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
