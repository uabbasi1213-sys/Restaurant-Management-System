import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  DollarSign, ShoppingCart, Users, AlertTriangle, TrendingUp, TrendingDown,
  Package, UtensilsCrossed, UserCheck, CreditCard, Clock, ArrowUpRight, ArrowDownRight, RefreshCw
} from 'lucide-react';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  preparing: 'bg-blue-100 text-blue-700',
  ready: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (profile) {
      loadDashboard();
    }
  }, [profile?.id]);

  const loadDashboard = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const result = await api.get('/dashboard/stats');
      if (!result || typeof result !== 'object' || !result.todaySales) {
        throw new Error('Invalid stats payload received');
      }
      setData(result);
      if (isManual) toast.success('Dashboard refreshed');
    } catch (err) {
      console.error('Dashboard error:', err.message);
      toast.error('Dashboard load failed: ' + err.message);
      // Set empty data so the spinner stops
      setData({
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
      });
    } finally {
      if (isManual) setRefreshing(false);
    }
  };

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600"></div>
    </div>
  );

  const todaySalesTotal = data.todaySales?.total || 0;
  const todaySalesCount = data.todaySales?.count || 0;
  const todayOrdersTotal = data.todayOrders?.total || 0;
  const todayOrdersPending = data.todayOrders?.pending || 0;
  const todayOrdersPreparing = data.todayOrders?.preparing || 0;
  const todayProfit = data.todayProfit || 0;
  const lowStock = data.lowStock || 0;
  const monthlySalesTotal = data.monthlySales?.total || 0;

  const statCards = [
    { label: "Today's Sales", value: `Rs. ${todaySalesTotal.toFixed(0)}`, sub: `${todaySalesCount} orders`, icon: DollarSign, color: 'bg-green-500', text: 'text-green-600' },
    { label: "Today's Orders", value: todayOrdersTotal, sub: `${todayOrdersPending} pending · ${todayOrdersPreparing} cooking`, icon: ShoppingCart, color: 'bg-blue-500', text: 'text-blue-600' },
    { label: "Today's Profit", value: `Rs. ${todayProfit.toFixed(0)}`, sub: `Income - Expenses`, icon: todayProfit >= 0 ? TrendingUp : TrendingDown, color: todayProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500', text: todayProfit >= 0 ? 'text-emerald-600' : 'text-red-600' },
    { label: 'Low Stock', value: lowStock, sub: 'items below minimum', icon: AlertTriangle, color: lowStock > 0 ? 'bg-red-500' : 'bg-gray-400', text: lowStock > 0 ? 'text-red-600' : 'text-gray-500' },
  ];

  const miniCards = [
    { label: 'Monthly Sales', value: `Rs. ${monthlySalesTotal.toFixed(0)}`, icon: DollarSign },
    { label: 'Menu Items', value: data.totalMenuItems || 0, icon: UtensilsCrossed },
    { label: 'Customers', value: data.totalCustomers || 0, icon: UserCheck },
    { label: 'Users', value: data.totalUsers || 0, icon: Users },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500">Welcome back, {profile?.full_name || user?.user_metadata?.full_name || profile?.username || user?.email?.split('@')[0] || 'Admin'}!</p>
        </div>
        <button
          onClick={() => loadDashboard(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl border border-gray-200 shadow-sm transition active:scale-95 disabled:opacity-50"
          title="Refresh dashboard stats"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin text-orange-600' : 'text-gray-500'} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div className={`${s.color} p-3 rounded-xl`}>
              <s.icon size={24} className="text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className={`text-xl font-bold ${s.text || 'text-gray-800'}`}>{s.value}</p>
              <p className="text-xs text-gray-400">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Mini Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {miniCards.map(m => (
          <div key={m.label} className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center gap-3">
            <m.icon size={18} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">{m.label}</p>
              <p className="text-lg font-bold text-gray-800">{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Sales Trend (7 days) */}
        <div className="bg-white rounded-xl shadow-sm p-5 lg:col-span-2">
          <h3 className="font-semibold text-gray-700 mb-4">Sales Trend (Last 7 Days)</h3>
          {data.salesTrend.length > 0 ? (
            <div className="flex items-end gap-2 h-40">
              {data.salesTrend.map(day => {
                const maxSale = Math.max(...data.salesTrend.map(d => d.total), 1);
                const height = Math.max((day.total / maxSale) * 100, 4);
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <p className="text-xs font-semibold text-gray-700">Rs.{(day.total / 1000).toFixed(1)}k</p>
                    <div className="w-full bg-orange-500 rounded-t-lg transition-all" style={{ height: `${height}%` }}></div>
                    <p className="text-[10px] text-gray-400">{day.date.slice(5)}</p>
                    <p className="text-[10px] text-gray-500">{day.orders} ord</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">No sales data yet</p>
          )}
        </div>

        {/* Payment Breakdown */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><CreditCard size={16} /> Payments Today</h3>
          {data.paymentBreakdown.length > 0 ? (
            <div className="space-y-3">
              {data.paymentBreakdown.map(p => {
                const totalAll = data.paymentBreakdown.reduce((s, x) => s + x.total, 0) || 1;
                const pct = ((p.total / totalAll) * 100).toFixed(0);
                return (
                  <div key={p.payment_type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-gray-600">{p.payment_type} ({p.count})</span>
                      <span className="font-semibold">Rs. {p.total.toFixed(0)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-orange-500 rounded-full h-2 transition-all" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">No payments today</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-sm p-5 lg:col-span-2">
          <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><Clock size={16} /> Recent Orders</h3>
          {data.recentOrders.length > 0 ? (
            <div className="space-y-2">
              {data.recentOrders.map(o => (
                <div key={o.order_number} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-sm text-gray-800">{o.order_number}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${STATUS_COLORS[o.status]}`}>{o.status}</span>
                    <span className="text-xs text-gray-400 capitalize">{o.order_type}{o.table_number ? ` · T${o.table_number}` : ''}</span>
                  </div>
                  <span className="font-semibold text-sm text-gray-700">Rs. {o.total?.toFixed(0)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">No orders yet</p>
          )}
        </div>

        {/* Top Items + Low Stock */}
        <div className="space-y-4">
          {/* Top Items */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><ArrowUpRight size={16} className="text-green-500" /> Top Sellers (Month)</h3>
            {data.topItems.length > 0 ? (
              <div className="space-y-2">
                {data.topItems.map((item, i) => (
                  <div key={item.item_name} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600"><span className="font-semibold text-gray-400 mr-2">#{i + 1}</span>{item.item_name}</span>
                    <span className="text-gray-800 font-semibold">{item.qty} sold</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center">No data</p>
            )}
          </div>

          {/* Low Stock Alert */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-red-500" /> Low Stock</h3>
            {data.lowStockItems.length > 0 ? (
              <div className="space-y-2">
                {data.lowStockItems.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{item.name}</span>
                    <span className="text-red-600 font-semibold">{item.current_stock}/{item.min_stock} {item.unit}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-green-500 text-center">All stock OK ✓</p>
            )}
          </div>
        </div>
      </div>

      {/* Today's Income vs Expense */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
          <div className="bg-green-100 p-3 rounded-xl">
            <ArrowUpRight size={24} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Today's Income</p>
            <p className="text-xl font-bold text-green-600">Rs. {(data.todaySales.total + data.todayIncome).toFixed(0)}</p>
            <p className="text-xs text-gray-400">Sales: Rs.{data.todaySales.total.toFixed(0)} + Other: Rs.{data.todayIncome.toFixed(0)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
          <div className="bg-red-100 p-3 rounded-xl">
            <ArrowDownRight size={24} className="text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Today's Expenses</p>
            <p className="text-xl font-bold text-red-600">Rs. {data.todayExpense.toFixed(0)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
