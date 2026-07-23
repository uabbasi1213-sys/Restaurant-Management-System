import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Lock, Unlock, CalendarCheck, TrendingUp, TrendingDown, Wallet, ShoppingCart, CreditCard, Receipt, AlertTriangle } from 'lucide-react';

export default function DailyClosing() {
  const { profile } = useAuth();
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('today');

  useEffect(() => { if (profile?.tenant_id) loadData(); }, [profile?.tenant_id]);

  const loadData = async () => {
    try {
      const { data: h, error: hErr } = await supabase
        .from('daily_closing')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('date', { ascending: false });
      
      if (hErr) { toast.error(hErr.message); return; }
      
      const historyData = h || [];
      setHistory(historyData);

      const todayStr = new Date().toISOString().slice(0, 10);
      const closedToday = historyData.find(x => x.date === todayStr);

      if (closedToday) {
        setToday({
          ...closedToday,
          is_closed: true,
          orders: { active: 0, completed: 0, cancelled: 0, total_orders: 0 },
          paymentBreakdown: [],
          expenseBreakdown: []
        });
      } else {
        const lastClosed = historyData[0];
        const opening_balance = lastClosed ? lastClosed.closing_balance : 0;

        const { data: orders } = await supabase.from('orders').select('*').eq('tenant_id', profile.tenant_id).gte('created_at', todayStr);
        const { data: payments } = await supabase.from('order_payments').select('*').eq('tenant_id', profile.tenant_id).gte('created_at', todayStr);
        const { data: expenses } = await supabase.from('expenses').select('*').eq('tenant_id', profile.tenant_id).eq('date', todayStr);
        const { data: incomes } = await supabase.from('income').select('*').eq('tenant_id', profile.tenant_id).eq('date', todayStr);

        const activeOrders = orders?.filter(o => o.status !== 'completed' && o.status !== 'cancelled') || [];
        const completedOrders = orders?.filter(o => o.status === 'completed') || [];
        const cancelledOrders = orders?.filter(o => o.status === 'cancelled') || [];
        
        const income_orders = payments?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0;
        const income_manual = incomes?.reduce((acc, i) => acc + (i.amount || 0), 0) || 0;
        const total_income = income_orders + income_manual;
        const total_expense = expenses?.reduce((acc, e) => acc + (e.amount || 0), 0) || 0;
        
        const pbMap = {};
        payments?.forEach(p => {
          pbMap[p.payment_method] = pbMap[p.payment_method] || { count: 0, total: 0 };
          pbMap[p.payment_method].count++;
          pbMap[p.payment_method].total += p.amount;
        });
        const paymentBreakdown = Object.keys(pbMap).map(k => ({ payment_type: k, count: pbMap[k].count, total: pbMap[k].total }));

        const ebMap = {};
        expenses?.forEach(e => {
          ebMap[e.category] = ebMap[e.category] || 0;
          ebMap[e.category] += e.amount;
        });
        const expenseBreakdown = Object.keys(ebMap).map(k => ({ category: k, total: ebMap[k] }));

        const closing_balance = opening_balance + total_income - total_expense;
        const net_profit = total_income - total_expense;

        setToday({
          date: todayStr,
          is_closed: false,
          opening_balance,
          total_income,
          income_orders,
          income_manual,
          total_expense,
          closing_balance,
          net_profit,
          orders: {
            active: activeOrders.length,
            completed: completedOrders.length,
            cancelled: cancelledOrders.length,
            total_orders: orders?.length || 0
          },
          paymentBreakdown,
          expenseBreakdown
        });
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const closeDay = async () => {
    if (!confirm('Close today? This will lock the day financials. Continue?')) return;
    try {
      const { error } = await supabase.from('daily_closing').insert({
        tenant_id: profile.tenant_id,
        date: today.date,
        opening_balance: today.opening_balance,
        total_income: today.total_income,
        total_expense: today.total_expense,
        closing_balance: today.closing_balance,
        closed_by: profile.id,
        closed_by_name: profile.full_name
      });
      if (error) { toast.error(error.message); return; }
      toast.success('Day closed successfully!');
      loadData();
    } catch (err) { toast.error(err.message); }
  };

  const reopenDay = async (date) => {
    if (!confirm(`Reopen ${date}? This will allow modifications.`)) return;
    try {
      const { error } = await supabase.from('daily_closing').delete().eq('tenant_id', profile.tenant_id).eq('date', date);
      if (error) { toast.error(error.message); return; }
      toast.success('Day reopened');
      loadData();
    } catch (err) { toast.error(err.message); }
  };

  if (!today) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Daily Closing</h1>
          <p className="text-gray-500 text-sm">{today.date}</p>
        </div>
        <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setTab('today')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'today' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-600'}`}>
            Today
          </button>
          <button onClick={() => setTab('history')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'history' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-600'}`}>
            History
          </button>
        </div>
      </div>

      {tab === 'today' ? (
        <>
          {/* Status Banner */}
          {today.is_closed && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
              <Lock size={20} className="text-green-600" />
              <p className="text-green-700 font-medium">Today is closed. All financials are locked.</p>
            </div>
          )}

          {today.orders?.active > 0 && !today.is_closed && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center gap-3">
              <AlertTriangle size={20} className="text-yellow-600" />
              <p className="text-yellow-700 font-medium">{today.orders.active} active orders still in progress. Complete or cancel them before closing.</p>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 text-gray-500 mb-2"><Wallet size={16} /> Opening Balance</div>
              <p className="text-2xl font-bold text-gray-800">Rs. {today.opening_balance?.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 text-green-600 mb-2"><TrendingUp size={16} /> Total Income</div>
              <p className="text-2xl font-bold text-green-600">Rs. {today.total_income?.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">Orders: Rs.{today.income_orders?.toFixed(2)} | Other: Rs.{today.income_manual?.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 text-red-600 mb-2"><TrendingDown size={16} /> Total Expenses</div>
              <p className="text-2xl font-bold text-red-600">Rs. {today.total_expense?.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 text-gray-500 mb-2"><CalendarCheck size={16} /> Closing Balance</div>
              <p className={`text-2xl font-bold ${today.closing_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Rs. {today.closing_balance?.toFixed(2)}
              </p>
              <p className={`text-xs mt-1 ${today.net_profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                Net: {today.net_profit >= 0 ? '+' : ''}Rs.{today.net_profit?.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Order & Payment Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Orders */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><ShoppingCart size={16} /> Orders Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Orders</span>
                  <span className="font-semibold">{today.orders?.total_orders || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Completed</span>
                  <span className="font-semibold text-green-600">{today.orders?.completed || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-yellow-600">Active</span>
                  <span className="font-semibold text-yellow-600">{today.orders?.active || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-500">Cancelled</span>
                  <span className="font-semibold text-red-500">{today.orders?.cancelled || 0}</span>
                </div>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><CreditCard size={16} /> Payment Breakdown</h3>
              {today.paymentBreakdown?.length > 0 ? (
                <div className="space-y-2">
                  {today.paymentBreakdown.map(p => (
                    <div key={p.payment_type} className="flex justify-between text-sm">
                      <span className="text-gray-600 capitalize">{p.payment_type} ({p.count})</span>
                      <span className="font-semibold">Rs. {p.total?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400">No payments today</p>}
            </div>
          </div>

          {/* Expense Breakdown */}
          {today.expenseBreakdown?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Receipt size={16} /> Expense Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {today.expenseBreakdown.map(e => (
                  <div key={e.category} className="bg-red-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">{e.category}</p>
                    <p className="font-semibold text-red-600">Rs. {e.total?.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Close Day Button */}
          {!today.is_closed && (
            <button
              onClick={closeDay}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Lock size={22} /> Close Today ({today.date})
            </button>
          )}
        </>
      ) : (
        /* History Tab */
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Opening</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Income</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Expenses</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Closing</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Net</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Closed By</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map(h => {
                  const net = h.total_income - h.total_expense;
                  return (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-semibold text-gray-800">{h.date}</td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">Rs. {h.opening_balance?.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-green-600">Rs. {h.total_income?.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-red-600">Rs. {h.total_expense?.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-bold text-gray-800">Rs. {h.closing_balance?.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-semibold text-sm ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {net >= 0 ? '+' : ''}Rs. {net.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{h.closed_by_name || '—'}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => reopenDay(h.date)} className="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center gap-1 ml-auto">
                          <Unlock size={14} /> Reopen
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {history.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">No closing records yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
