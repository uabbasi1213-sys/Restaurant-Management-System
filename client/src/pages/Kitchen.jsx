import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { ChefHat, Clock, CheckCircle2, AlertCircle, RefreshCw, Flame } from 'lucide-react';

const STATUS_CONFIG = {
  pending: { color: 'border-yellow-400 bg-yellow-50', badge: 'bg-yellow-500 text-white', label: 'NEW', icon: AlertCircle },
  preparing: { color: 'border-blue-400 bg-blue-50', badge: 'bg-blue-500 text-white', label: 'COOKING', icon: Flame },
};

const ITEM_STATUS = {
  pending: 'bg-yellow-100 text-yellow-700',
  preparing: 'bg-blue-100 text-blue-700',
  ready: 'bg-green-100 text-green-700',
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

export default function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef(null);
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.tenant_id) {
      loadData();
      // Auto-refresh every 10 seconds
      intervalRef.current = setInterval(loadData, 10000);
    }
    return () => clearInterval(intervalRef.current);
  }, [profile?.tenant_id]);

  const loadData = async () => {
    try {
      if (!profile?.tenant_id) return;
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('tenant_id', profile.tenant_id)
        .in('status', ['pending', 'preparing'])
        .order('created_at', { ascending: true });

      if (error) { toast.error(error.message); return; }
      
      const ordersList = ordersData || [];
      // Also fetch items for these orders to map them like the API did
      // With the `*, order_items(*)` they are joined inside the `order_items` key, we'll map them to `items` for compatibility
      const mappedOrders = ordersList.map(o => ({
        ...o,
        items: o.order_items || []
      }));

      setOrders(mappedOrders);

      // Fetch stats
      const statsData = {
        pending: mappedOrders.filter(o => o.status === 'pending').length,
        preparing: mappedOrders.filter(o => o.status === 'preparing').length,
        ready: 0,
        completed_today: 0
      };

      const { count: readyCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', profile.tenant_id)
        .eq('status', 'ready');
      statsData.ready = readyCount || 0;

      const today = new Date();
      today.setHours(0,0,0,0);
      const { count: completedCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', profile.tenant_id)
        .eq('status', 'completed')
        .gte('created_at', today.toISOString());
      statsData.completed_today = completedCount || 0;

      setStats(statsData);
    } catch (err) { /* silent refresh */ }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);
      if (error) { toast.error(error.message); return; }
      toast.success(`Order → ${status}`);
      loadData();
    } catch (err) { toast.error(err.message); }
  };

  const updateItemStatus = async (itemId, status) => {
    try {
      const { error } = await supabase
        .from('order_items')
        .update({ status })
        .eq('id', itemId);
      if (error) { toast.error(error.message); return; }
      loadData();
    } catch (err) { toast.error(err.message); }
  };

  const manualRefresh = () => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ChefHat size={28} /> Kitchen Display
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {orders.length} active orders • Auto-refreshes every 10s
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Stats Pills */}
          <div className="flex gap-2">
            <div className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
              {stats.pending || 0} Pending
            </div>
            <div className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
              {stats.preparing || 0} Cooking
            </div>
            <div className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
              {stats.ready || 0} Ready
            </div>
            <div className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
              {stats.completed_today || 0} Done Today
            </div>
          </div>
          <button
            onClick={manualRefresh}
            className={`p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition ${loading ? 'animate-spin' : ''}`}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Orders Grid */}
      {orders.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <ChefHat size={56} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">No active orders</p>
          <p className="text-sm">New orders will appear here automatically</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map(order => {
            const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = config.icon;
            const elapsed = timeAgo(order.created_at);
            const isUrgent = (Date.now() - new Date(order.created_at).getTime()) > 15 * 60 * 1000; // >15min

            return (
              <div
                key={order.id}
                className={`rounded-2xl border-2 ${config.color} ${isUrgent ? 'ring-2 ring-red-400 ring-offset-2' : ''} overflow-hidden shadow-sm`}
              >
                {/* Card Header */}
                <div className="p-4 border-b border-white/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-gray-800">{order.order_number}</span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${config.badge} flex items-center gap-1`}>
                      <StatusIcon size={12} /> {config.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 capitalize">
                      {order.order_type}
                      {order.table_number && <span className="font-semibold"> • Table {order.table_number}</span>}
                    </span>
                    <span className={`flex items-center gap-1 font-medium ${isUrgent ? 'text-red-600' : 'text-gray-500'}`}>
                      <Clock size={14} /> {elapsed}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="p-3 space-y-1.5">
                  {order.items?.map(item => (
                    <div key={item.id} className="flex items-center gap-2 bg-white/70 rounded-lg p-2">
                      <button
                        onClick={() => {
                          const next = item.status === 'pending' ? 'preparing' : item.status === 'preparing' ? 'ready' : item.status;
                          if (next !== item.status) updateItemStatus(item.id, next);
                        }}
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition ${
                          item.status === 'ready'
                            ? 'bg-green-500 text-white'
                            : item.status === 'preparing'
                              ? 'bg-blue-500 text-white hover:bg-green-500'
                              : 'bg-gray-300 text-gray-500 hover:bg-blue-500 hover:text-white'
                        }`}
                        title={`Click to advance: ${item.status}`}
                      >
                        {item.status === 'ready' ? <CheckCircle2 size={14} /> : <span className="text-xs font-bold">{item.quantity}</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${item.status === 'ready' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {item.quantity}× {item.item_name}
                        </p>
                        {item.special_instructions && (
                          <p className="text-xs text-orange-600">⚡ {item.special_instructions}</p>
                        )}
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${ITEM_STATUS[item.status] || ITEM_STATUS.pending}`}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Card Actions */}
                <div className="p-3 border-t border-white/50 flex gap-2">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'preparing')}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-bold transition active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Flame size={16} /> Start Cooking
                    </button>
                  )}
                  {order.status === 'preparing' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'ready')}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-bold transition active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={16} /> Mark Ready
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
