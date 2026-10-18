import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  ClipboardList, Eye, X, Printer, Pencil,
  Plus, Minus, Trash2, ShoppingCart, ImageIcon, Search, UtensilsCrossed
} from 'lucide-react';
import InvoiceModal from '../components/InvoiceModal';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  preparing: 'bg-blue-100 text-blue-700',
  ready: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700'
};

const TYPE_COLORS = {
  'dine-in': 'bg-blue-50 text-blue-600',
  takeaway: 'bg-orange-50 text-orange-600',
  delivery: 'bg-green-50 text-green-600'
};

export default function Orders() {
  const [orders, setOrders]               = useState([]);
  const [filterStatus, setFilterStatus]   = useState('');
  const [filterType, setFilterType]       = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [printOrderId, setPrintOrderId]   = useState(null);

  // Edit modal state
  const [editOrder, setEditOrder]             = useState(null);
  const [editCart, setEditCart]               = useState([]);
  const [editOrderType, setEditOrderType]     = useState('dine-in');
  const [editTable, setEditTable]             = useState('');
  const [editPayment, setEditPayment]         = useState('cash');
  const [editDiscount, setEditDiscount]       = useState('');
  const [editTax, setEditTax]                 = useState('');
  const [editStatus, setEditStatus]           = useState('');
  const [editSaving, setEditSaving]           = useState(false);

  // POS menu for edit modal
  const [menuItems, setMenuItems]             = useState([]);
  const [categories, setCategories]           = useState([]);
  const [selCat, setSelCat]                   = useState('');
  const [menuSearch, setMenuSearch]           = useState('');
  const [menuLoaded, setMenuLoaded]           = useState(false);

  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.id) loadOrders();
  }, [filterStatus, filterType, profile?.id]);

  const loadOrders = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterType) params.append('order_type', filterType);
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await api.get(`/orders${query}`);
      setOrders(data || []);
    } catch (err) { toast.error(err.message); }
  };

  const viewOrder = async (order) => {
    try {
      const data = await api.get(`/orders/${order.id}`);
      setSelectedOrder(data);
    } catch (err) { toast.error(err.message); }
  };

  const updateStatus = async (orderId, status) => {
    try {
      await api.put('/orders/' + orderId, { status });
      toast.success(`Order status updated to ${status}`);
      loadOrders();
      if (selectedOrder?.id === orderId) {
        viewOrder({ id: orderId });
      }
    } catch (err) { toast.error(err.message); }
  };

  // ─── Open Edit Modal ───────────────────────────────────────────────────────
  const openEdit = async (order) => {
    try {
      const data = await api.get(`/orders/${order.id}`);
      setEditOrder(data);
      setEditCart((data.items || []).map(item => ({
        menu_item_id:         item.menu_item_id,
        item_name:            item.item_name,
        price:                item.price,
        quantity:             item.quantity,
        total:                item.total,
        special_instructions: item.special_instructions || ''
      })));
      setEditOrderType(data.order_type || 'dine-in');
      setEditTable(data.table_number || '');
      setEditPayment(data.payment_type || 'cash');
      setEditDiscount(data.discount || '');
      setEditTax(data.tax || '');
      setEditStatus(data.status || 'pending');

      if (!menuLoaded) {
        const [cats, items] = await Promise.all([
          api.get('/menu-categories'),
          api.get('/menu-items?available=true')
        ]);
        setCategories(Array.isArray(cats)  ? cats  : cats.categories || []);
        setMenuItems(Array.isArray(items)  ? items : items.items     || []);
        setMenuLoaded(true);
      }
    } catch (err) { toast.error(err.message); }
  };

  const closeEdit = () => {
    setEditOrder(null);
    setEditCart([]);
    setMenuSearch('');
    setSelCat('');
  };

  // ─── Cart Helpers ──────────────────────────────────────────────────────────
  const addToEditCart = (item) => {
    const existing = editCart.find(c => c.menu_item_id === item.id);
    if (existing) {
      setEditCart(editCart.map(c =>
        c.menu_item_id === item.id
          ? { ...c, quantity: c.quantity + 1, total: (c.quantity + 1) * c.price }
          : c
      ));
    } else {
      setEditCart([...editCart, {
        menu_item_id:         item.id,
        item_name:            item.name,
        price:                item.sale_price,
        quantity:             1,
        total:                item.sale_price,
        special_instructions: ''
      }]);
    }
  };

  const changeQty = (menuItemId, delta) => {
    setEditCart(editCart.map(c => {
      if (c.menu_item_id === menuItemId) {
        const newQty = c.quantity + delta;
        if (newQty <= 0) return null;
        return { ...c, quantity: newQty, total: newQty * c.price };
      }
      return c;
    }).filter(Boolean));
  };

  const removeFromEdit   = (menuItemId) => setEditCart(editCart.filter(c => c.menu_item_id !== menuItemId));
  const updateInstructions = (menuItemId, val) =>
    setEditCart(editCart.map(c => c.menu_item_id === menuItemId ? { ...c, special_instructions: val } : c));

  // ─── Computed Totals ───────────────────────────────────────────────────────
  const editSubtotal   = editCart.reduce((s, i) => s + i.total, 0);
  const editTaxAmt     = parseFloat(editTax)      || 0;
  const editDiscAmt    = parseFloat(editDiscount) || 0;
  const editGrandTotal = editSubtotal + editTaxAmt - editDiscAmt;

  // ─── Save Edited Order ─────────────────────────────────────────────────────
  const saveEdit = async () => {
    if (editCart.length === 0) return toast.error('Order must have at least one item!');
    setEditSaving(true);
    try {
      await api.put(`/orders/${editOrder.id}`, {
        order_type:   editOrderType,
        table_number: editTable || null,
        payment_type: editPayment,
        discount:     editDiscAmt,
        tax:          editTaxAmt,
        subtotal:     editSubtotal,
        total:        editGrandTotal,
        status:       editStatus,
        items: editCart.map(item => ({
          menu_item_id:         item.menu_item_id,
          item_name:            item.item_name,
          quantity:             item.quantity,
          price:                item.price,
          total:                item.total,
          special_instructions: item.special_instructions || null
        }))
      });
      toast.success('Order updated successfully!');
      closeEdit();
      loadOrders();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  // ─── Filtered menu in edit modal ───────────────────────────────────────────
  const filteredMenu = menuItems.filter(item => {
    const matchCat    = selCat     ? item.category_id === selCat : true;
    const matchSearch = menuSearch ? item.name.toLowerCase().includes(menuSearch.toLowerCase()) : true;
    return matchCat && matchSearch;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Orders</h1>
          <p className="text-gray-500 text-sm">{orders.length} orders</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {['', 'pending', 'preparing', 'ready', 'completed', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition capitalize ${
                filterStatus === s ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >{s || 'All'}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {['', 'dine-in', 'takeaway', 'delivery'].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition capitalize ${
                filterType === t ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >{t || 'All Types'}</button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Order #</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Table</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Payment</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Time</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono font-semibold text-gray-800 text-sm">{order.order_number}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize ${TYPE_COLORS[order.order_type] || 'bg-gray-100 text-gray-600'}`}>
                      {order.order_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {order.table_number ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <UtensilsCrossed size={12} /> {order.table_number}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize ${STATUS_COLORS[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 capitalize">{order.payment_type}</td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-800">Rs. {order.total?.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(order.created_at).toLocaleTimeString()}</td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                    <button
                      onClick={() => viewOrder(order)}
                      title="View Details"
                      className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => openEdit(order)}
                      title="Edit Order (Add/Remove Items)"
                      className="text-orange-500 hover:text-orange-700 p-1.5 rounded-lg hover:bg-orange-50"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setPrintOrderId(order.id)}
                      title="Print Invoice"
                      className="text-green-600 hover:text-green-800 p-1.5 rounded-lg hover:bg-green-50"
                    >
                      <Printer size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    <ClipboardList size={32} className="mx-auto mb-2 opacity-50" />
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="text-lg font-bold">{selectedOrder.order_number}</h3>
                <p className="text-sm text-gray-500 capitalize">
                  {selectedOrder.order_type} {selectedOrder.table_number ? `• Table ${selectedOrder.table_number}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSelectedOrder(null); openEdit(selectedOrder); }}
                  title="Edit Order"
                  className="flex items-center gap-1 text-orange-600 hover:text-orange-800 text-sm font-medium border border-orange-200 rounded-lg px-2.5 py-1 hover:bg-orange-50"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {/* Status Update */}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Update Status:</p>
                <div className="flex gap-1 flex-wrap">
                  {['pending', 'preparing', 'ready', 'completed', 'cancelled'].map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus(selectedOrder.id, s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                        selectedOrder.status === s
                          ? STATUS_COLORS[s] + ' ring-2 ring-offset-1 ring-gray-300'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >{s}</button>
                  ))}
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2 mb-4">
                <p className="text-sm font-medium text-gray-700">Items:</p>
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-50 rounded-lg p-3">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{item.item_name}</p>
                      <p className="text-xs text-gray-500">
                        {item.quantity} × Rs. {item.price?.toFixed(2)}
                        {item.special_instructions && <span className="ml-2 text-orange-500">• {item.special_instructions}</span>}
                      </p>
                    </div>
                    <p className="font-semibold text-sm">Rs. {item.total?.toFixed(2)}</p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span><span>Rs. {selectedOrder.subtotal?.toFixed(2)}</span>
                </div>
                {selectedOrder.tax > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Tax</span><span>Rs. {selectedOrder.tax?.toFixed(2)}</span>
                  </div>
                )}
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span><span>-Rs. {selectedOrder.discount?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-gray-800 pt-2 border-t">
                  <span>Total</span><span className="text-orange-600">Rs. {selectedOrder.total?.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-400 text-right capitalize">Payment: {selectedOrder.payment_type}</p>
              </div>

              <button
                onClick={() => setPrintOrderId(selectedOrder.id)}
                className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-semibold transition flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Order Modal ───────────────────────────────────────────────── */}
      {editOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 md:p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col" style={{ maxHeight: '95vh' }}>

            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  ✏️ Edit Order — {editOrder.order_number}
                </h3>
                <p className="text-xs text-gray-500">Add or remove items from this order</p>
              </div>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={22} />
              </button>
            </div>

            {/* Modal Body — two-column layout */}
            <div className="flex flex-1 overflow-hidden flex-col md:flex-row">

              {/* LEFT — Menu Picker */}
              <div className="flex-1 flex flex-col overflow-hidden border-r bg-gray-50 p-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">📋 Menu Items — click to add</p>

                {/* Search */}
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={e => setMenuSearch(e.target.value)}
                    placeholder="Search menu..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>

                {/* Category Tabs */}
                <div className="flex gap-1.5 flex-wrap mb-3">
                  <button
                    onClick={() => setSelCat('')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      !selCat ? 'bg-orange-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-100'
                    }`}
                  >All</button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelCat(cat.id === selCat ? '' : cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        selCat === cat.id ? 'bg-orange-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-100'
                      }`}
                    >{cat.name}</button>
                  ))}
                </div>

                {/* Items Grid */}
                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {filteredMenu.map(item => {
                      const inCart = editCart.find(c => c.menu_item_id === item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => addToEditCart(item)}
                          className={`bg-white rounded-xl shadow-sm overflow-hidden text-left hover:shadow-md transition active:scale-95 relative ${
                            inCart ? 'ring-2 ring-orange-500' : ''
                          }`}
                        >
                          <div className="aspect-[4/3] bg-gray-100">
                            {item.image
                              ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={20} className="text-gray-300" /></div>
                            }
                          </div>
                          <div className="p-2">
                            <p className="font-medium text-gray-800 text-xs truncate">{item.name}</p>
                            <p className="text-orange-600 font-bold text-sm">Rs. {item.sale_price}</p>
                          </div>
                          {inCart && (
                            <div className="absolute top-1.5 right-1.5 bg-orange-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                              {inCart.quantity}
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {filteredMenu.length === 0 && (
                      <div className="col-span-3 text-center py-8 text-gray-400 text-sm">No items found</div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT — Edit Cart */}
              <div className="w-full md:w-80 lg:w-96 flex flex-col bg-white overflow-hidden">

                {/* Order Attributes */}
                <div className="p-3 border-b space-y-2 flex-shrink-0">
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    {['dine-in', 'takeaway', 'delivery'].map(t => (
                      <button
                        key={t}
                        onClick={() => setEditOrderType(t)}
                        className={`flex-1 py-1.5 rounded-md text-xs font-medium transition capitalize ${
                          editOrderType === t ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
                        }`}
                      >{t}</button>
                    ))}
                  </div>

                  {editOrderType === 'dine-in' && (
                    <input
                      type="text"
                      value={editTable}
                      onChange={e => setEditTable(e.target.value)}
                      placeholder="Table number..."
                      className="w-full px-3 py-1.5 rounded-lg border text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  )}

                  <div>
                    <p className="text-xs text-gray-500 mb-1 font-medium">Status</p>
                    <div className="flex gap-1 flex-wrap">
                      {['pending', 'preparing', 'ready', 'completed', 'cancelled'].map(s => (
                        <button
                          key={s}
                          onClick={() => setEditStatus(s)}
                          className={`px-2 py-1 rounded-lg text-xs font-medium capitalize transition ${
                            editStatus === s
                              ? STATUS_COLORS[s] + ' ring-1 ring-gray-300'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >{s}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {editCart.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Add items from menu</p>
                    </div>
                  ) : (
                    editCart.map(item => (
                      <div key={item.menu_item_id} className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 text-sm truncate">{item.item_name}</p>
                            <p className="text-orange-600 text-xs font-semibold">Rs. {item.price} each</p>
                          </div>
                          <button onClick={() => removeFromEdit(item.menu_item_id)} className="text-red-400 hover:text-red-600 p-1">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2 bg-white rounded-lg border">
                            <button onClick={() => changeQty(item.menu_item_id, -1)} className="p-1.5 hover:bg-gray-100 rounded-l-lg">
                              <Minus size={14} />
                            </button>
                            <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                            <button onClick={() => changeQty(item.menu_item_id, 1)} className="p-1.5 hover:bg-gray-100 rounded-r-lg">
                              <Plus size={14} />
                            </button>
                          </div>
                          <p className="font-bold text-gray-800 text-sm">Rs. {item.total.toFixed(2)}</p>
                        </div>
                        <input
                          type="text"
                          value={item.special_instructions}
                          onChange={e => updateInstructions(item.menu_item_id, e.target.value)}
                          placeholder="Special instructions..."
                          className="w-full mt-2 px-2 py-1 rounded-md border text-xs focus:ring-1 focus:ring-orange-500 outline-none"
                        />
                      </div>
                    ))
                  )}
                </div>

                {/* Footer — Totals + Payment + Save */}
                <div className="border-t p-3 space-y-2 flex-shrink-0">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-semibold">Rs. {editSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number" min="0" step="0.01"
                      value={editDiscount}
                      onChange={e => setEditDiscount(e.target.value)}
                      placeholder="Discount"
                      className="px-2 py-1.5 rounded-lg border text-sm focus:ring-1 focus:ring-orange-500 outline-none"
                    />
                    <input
                      type="number" min="0" step="0.01"
                      value={editTax}
                      onChange={e => setEditTax(e.target.value)}
                      placeholder="Tax"
                      className="px-2 py-1.5 rounded-lg border text-sm focus:ring-1 focus:ring-orange-500 outline-none"
                    />
                  </div>
                  <div className="flex justify-between text-lg font-bold text-gray-800 pt-1 border-t">
                    <span>Total</span>
                    <span className="text-orange-600">Rs. {editGrandTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    {['cash', 'card', 'online', 'credit'].map(t => (
                      <button
                        key={t}
                        onClick={() => setEditPayment(t)}
                        className={`flex-1 py-1.5 rounded-md text-xs font-medium transition capitalize ${
                          editPayment === t ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
                        }`}
                      >{t}</button>
                    ))}
                  </div>
                  <button
                    onClick={saveEdit}
                    disabled={editSaving}
                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2"
                  >
                    {editSaving ? 'Saving...' : '💾 Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {printOrderId && <InvoiceModal orderId={printOrderId} onClose={() => setPrintOrderId(null)} />}
    </div>
  );
}
