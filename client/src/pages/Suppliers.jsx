import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, BookOpen, ArrowLeft, DollarSign, TrendingUp, TrendingDown, Truck } from 'lucide-react';

export default function Suppliers() {
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', company: '', phone: '', address: '' });

  // Ledger state
  const [ledgerSupplier, setLedgerSupplier] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', description: '' });

  useEffect(() => {
    if (profile) loadSuppliers();
  }, [profile?.id]);

  const loadSuppliers = async () => {
    try {
      const data = await api.get('/suppliers');
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) { toast.error(err.message); }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', company: '', phone: '', address: '' });
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, company: s.company || '', phone: s.phone || '', address: s.address || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/suppliers/${editing.id}`, form);
        toast.success('Supplier updated');
      } else {
        await api.post('/suppliers', { ...form, tenant_id: profile?.tenant_id });
        toast.success('Supplier added');
      }
      setShowModal(false);
      loadSuppliers();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (s) => {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    try {
      await api.delete(`/suppliers/${s.id}`);
      toast.success('Supplier deleted');
      loadSuppliers();
    } catch (err) { toast.error(err.message); }
  };

  // Ledger functions
  const openLedger = async (supplier) => {
    try {
      const data = await api.get(`/suppliers/${supplier.id}/ledger`);
      setLedgerSupplier(supplier);
      setLedgerData({
        transactions: data.transactions || [],
        totalPurchases: data.totalPurchases || 0,
        totalPayments: data.totalPayments || 0,
        balance: data.balance || 0
      });
    } catch (err) { toast.error(err.message); }
  };

  const closeLedger = () => {
    setLedgerSupplier(null);
    setLedgerData(null);
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/suppliers/${ledgerSupplier.id}/payment`, {
        amount: parseFloat(paymentForm.amount),
        description: paymentForm.description
      });
      toast.success('Payment recorded');
      setShowPaymentModal(false);
      setPaymentForm({ amount: '', description: '' });
      openLedger(ledgerSupplier);
      loadSuppliers();
    } catch (err) { toast.error(err.message); }
  };

  // --- LEDGER VIEW ---
  if (ledgerSupplier && ledgerData) {
    return (
      <div>
        <button onClick={closeLedger} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 text-sm">
          <ArrowLeft size={16} /> Back to Suppliers
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{ledgerSupplier.name}</h1>
            <p className="text-gray-500 text-sm">
              {ledgerSupplier.company && `${ledgerSupplier.company} • `}{ledgerSupplier.phone || 'No phone'}
            </p>
          </div>
          <button
            onClick={() => { setPaymentForm({ amount: '', description: '' }); setShowPaymentModal(true); }}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-medium transition"
          >
            <DollarSign size={18} /> Add Payment
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div className="bg-red-100 p-3 rounded-xl"><TrendingUp size={24} className="text-red-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Purchases</p>
              <p className="text-xl font-bold text-red-600">Rs. {ledgerData.totalPurchases?.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-xl"><TrendingDown size={24} className="text-green-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Payments</p>
              <p className="text-xl font-bold text-green-600">Rs. {ledgerData.totalPayments?.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div className={`${ledgerData.balance > 0 ? 'bg-orange-100' : 'bg-blue-100'} p-3 rounded-xl`}>
              <DollarSign size={24} className={ledgerData.balance > 0 ? 'text-orange-600' : 'text-blue-600'} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Balance Due</p>
              <p className={`text-xl font-bold ${ledgerData.balance > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                Rs. {ledgerData.balance?.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-800">Ledger Transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ledgerData.transactions?.map(txn => (
                  <tr key={txn.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {new Date(txn.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                        txn.type === 'purchase' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {txn.type === 'purchase' ? 'Purchase' : 'Payment'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{txn.description}</td>
                    <td className={`px-6 py-3 text-right font-semibold ${
                      txn.type === 'purchase' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {txn.type === 'purchase' ? '+' : '-'} Rs. {txn.amount?.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {(!ledgerData.transactions || ledgerData.transactions.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                      No transactions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
              <div className="flex items-center justify-between p-5 border-b">
                <h3 className="text-lg font-semibold">Add Payment</h3>
                <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handlePayment} className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.) *</label>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-lg"
                    placeholder="0.00" required autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={paymentForm.description}
                    onChange={e => setPaymentForm({...paymentForm, description: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    placeholder="Payment description"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowPaymentModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium">
                    Record Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- SUPPLIERS LIST VIEW ---
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Supplier Management</h1>
          <p className="text-gray-500 text-sm">{suppliers.length} suppliers</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-medium transition">
          <Plus size={18} /> Add Supplier
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Company</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Balance</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Truck size={18} className="text-purple-600" />
                      </div>
                      <span className="font-medium text-gray-800">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.company || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.phone || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-semibold ${s.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      Rs. {(s.balance || 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openLedger(s)} className="text-purple-600 hover:text-purple-800 p-1.5 rounded-lg hover:bg-purple-50 mr-1" title="View Ledger">
                      <BookOpen size={16} />
                    </button>
                    <button onClick={() => openEdit(s)} className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50 mr-1">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(s)} className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    <Truck size={32} className="mx-auto mb-2 opacity-50" />
                    No suppliers yet. Add your first supplier!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-semibold">{editing ? 'Edit Supplier' : 'Add Supplier'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text" value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="Supplier name" required autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input
                  type="text" value={form.company}
                  onChange={e => setForm({...form, company: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="Company name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text" value={form.phone}
                  onChange={e => setForm({...form, phone: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="Phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={form.address}
                  onChange={e => setForm({...form, address: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  rows={2} placeholder="Address"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-medium">
                  {editing ? 'Update' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
