import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { ClipboardList, Eye, X, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
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
  const [orders, setOrders] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [printOrderId, setPrintOrderId] = useState(null);
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.tenant_id) {
      loadOrders();
    }
  }, [filterStatus, filterType, profile?.tenant_id]);

  const loadOrders = async () => {
    try {
      let query = supabase
        .from('orders')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (filterStatus) query = query.eq('status', filterStatus);
      if (filterType) query = query.eq('order_type', filterType);

      const { data, error } = await query;
      if (error) { toast.error(error.message); return; }
      setOrders(data || []);
    } catch (err) { toast.error(err.message); }
  };

  const viewOrder = async (order) => {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', order.id)
        .single();
      if (orderError) { toast.error(orderError.message); return; }

      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);
      if (itemsError) { toast.error(itemsError.message); return; }

      setSelectedOrder({ ...orderData, items: itemsData || [] });
    } catch (err) { toast.error(err.message); }
  };

  const updateStatus = async (orderId, status) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);
      if (error) { toast.error(error.message); return; }

      toast.success(`Order status updated to ${status}`);
      loadOrders();
      if (selectedOrder?.id === orderId) {
        viewOrder({ id: orderId });
      }
    } catch (err) { toast.error(err.message); }
  };

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
                  <td className="px-6 py-4 text-sm text-gray-600">{order.table_number || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize ${STATUS_COLORS[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 capitalize">{order.payment_type}</td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-800">Rs. {order.total?.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(order.created_at).toLocaleTimeString()}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => viewOrder(order)} className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50">
                      <Eye size={16} />
                    </button>
                    <button onClick={() => setPrintOrderId(order.id)} className="text-green-600 hover:text-green-800 p-1.5 rounded-lg hover:bg-green-50 ml-1">
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
                <p className="text-sm text-gray-500 capitalize">{selectedOrder.order_type} {selectedOrder.table_number ? `• Table ${selectedOrder.table_number}` : ''}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
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

      {printOrderId && <InvoiceModal orderId={printOrderId} onClose={() => setPrintOrderId(null)} />}
    </div>
  );
}
