import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { BarChart3, TrendingUp, TrendingDown, Package, UserCheck, DollarSign, ShoppingCart, CreditCard, Calendar } from 'lucide-react';

const TABS = [
  { key: 'sales', label: 'Sales', icon: ShoppingCart },
  { key: 'profit-loss', label: 'Profit & Loss', icon: DollarSign },
  { key: 'expenses', label: 'Expenses', icon: TrendingDown },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'customers', label: 'Customers', icon: UserCheck },
];

export default function Reports() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('sales');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 8) + '01');
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (profile) loadReport(); }, [tab, dateFrom, dateTo, profile?.id]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = `date_from=${dateFrom}&date_to=${dateTo}`;
      
      if (tab === 'sales') {
        const result = await api.get(`/reports/sales?${params}`);
        setData(result);
      } 
      else if (tab === 'profit-loss') {
        const result = await api.get(`/reports/profit-loss?${params}`);
        setData(result);
      }
      else if (tab === 'expenses') {
        const result = await api.get(`/reports/expenses?${params}`);
        setData(result);
      }
      else if (tab === 'inventory') {
        const result = await api.get('/reports/inventory');
        setData(result);
      }
      else if (tab === 'customers') {
        const result = await api.get(`/reports/customers?${params}`);
        setData(result);
      }
    } catch (err) { toast.error(err.message); }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><BarChart3 size={28} /> Reports</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              tab === t.key ? 'bg-white shadow-sm text-orange-600' : 'text-gray-600 hover:bg-gray-200'
            }`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Date Filters (not for inventory) */}
      {tab !== 'inventory' && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>
          <div className="flex gap-2">
            {[
              { label: 'Today', fn: () => { const t = new Date().toISOString().slice(0,10); setDateFrom(t); setDateTo(t); }},
              { label: 'This Week', fn: () => { const d = new Date(); d.setDate(d.getDate()-d.getDay()); setDateFrom(d.toISOString().slice(0,10)); setDateTo(new Date().toISOString().slice(0,10)); }},
              { label: 'This Month', fn: () => { setDateFrom(new Date().toISOString().slice(0,8)+'01'); setDateTo(new Date().toISOString().slice(0,10)); }},
              { label: 'Last 30 Days', fn: () => { const d = new Date(); d.setDate(d.getDate()-30); setDateFrom(d.toISOString().slice(0,10)); setDateTo(new Date().toISOString().slice(0,10)); }},
            ].map(q => (
              <button key={q.label} onClick={q.fn} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-600 transition">{q.label}</button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div></div>
      ) : data && (
        <>
          {tab === 'sales' && <SalesReport data={data} />}
          {tab === 'profit-loss' && <ProfitLossReport data={data} />}
          {tab === 'expenses' && <ExpenseReport data={data} />}
          {tab === 'inventory' && <InventoryReport data={data} />}
          {tab === 'customers' && <CustomerReport data={data} />}
        </>
      )}
    </div>
  );
}

function SalesReport({ data }) {
  const { summary, byDate, byType, byPayment, topItems } = data;
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Orders', value: summary.total_orders, color: 'text-gray-800' },
          { label: 'Completed Sales', value: `Rs. ${summary.completed_sales?.toFixed(0)}`, color: 'text-green-600' },
          { label: 'Avg Order', value: `Rs. ${summary.avg_order?.toFixed(0)}`, color: 'text-blue-600' },
          { label: 'Cancelled', value: summary.cancelled, color: 'text-red-600' },
          { label: 'Total Revenue', value: `Rs. ${summary.total_sales?.toFixed(0)}`, color: 'text-orange-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Sales chart */}
      {byDate.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Sales by Date</h3>
          <div className="flex items-end gap-1 h-44 overflow-x-auto">
            {byDate.map(d => {
              const max = Math.max(...byDate.map(x => x.sales), 1);
              const h = Math.max((d.sales / max) * 100, 3);
              return (
                <div key={d.period} className="flex-1 min-w-[30px] flex flex-col items-center gap-1">
                  <p className="text-[10px] font-semibold text-gray-600">Rs.{(d.sales/1000).toFixed(1)}k</p>
                  <div className="w-full bg-orange-500 rounded-t-md" style={{height:`${h}%`}}></div>
                  <p className="text-[9px] text-gray-400 truncate w-full text-center">{d.period.slice(5)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* By Type */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-3">By Order Type</h3>
          <div className="space-y-3">
            {byType.map(t => (
              <div key={t.order_type} className="flex justify-between text-sm">
                <span className="text-gray-600 capitalize">{t.order_type} ({t.orders})</span>
                <span className="font-semibold">Rs. {t.sales?.toFixed(0)}</span>
              </div>
            ))}
            {byType.length === 0 && <p className="text-sm text-gray-400">No data</p>}
          </div>
        </div>

        {/* By Payment */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-3">By Payment Type</h3>
          <div className="space-y-3">
            {byPayment.map(p => (
              <div key={p.payment_type} className="flex justify-between text-sm">
                <span className="text-gray-600 capitalize">{p.payment_type} ({p.orders})</span>
                <span className="font-semibold">Rs. {p.sales?.toFixed(0)}</span>
              </div>
            ))}
            {byPayment.length === 0 && <p className="text-sm text-gray-400">No data</p>}
          </div>
        </div>

        {/* Top Items */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Top Selling Items</h3>
          <div className="space-y-2">
            {topItems.map((item, i) => (
              <div key={item.item_name} className="flex justify-between text-sm">
                <span className="text-gray-600"><span className="text-gray-400 mr-1">#{i+1}</span> {item.item_name}</span>
                <span className="font-semibold">{item.qty} — Rs.{item.revenue?.toFixed(0)}</span>
              </div>
            ))}
            {topItems.length === 0 && <p className="text-sm text-gray-400">No data</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfitLossReport({ data }) {
  return (
    <div className="space-y-6">
      {/* P&L Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Total Income</p>
          <p className="text-2xl font-bold text-green-600">Rs. {data.totalIncome?.toFixed(0)}</p>
          <p className="text-xs text-gray-400 mt-1">Sales: Rs.{data.salesIncome?.toFixed(0)} | Other: Rs.{data.otherIncome?.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600">Rs. {data.totalExpense?.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Net Profit</p>
          <p className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data.netProfit >= 0 ? '+' : ''}Rs. {data.netProfit?.toFixed(0)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Profit Margin</p>
          <p className={`text-2xl font-bold ${data.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{data.profitMargin}%</p>
        </div>
      </div>

      {/* Visual P&L bar */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-700 mb-4">Profit & Loss Breakdown</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1"><span className="text-green-600 font-medium">Income</span><span className="font-semibold">Rs. {data.totalIncome?.toFixed(0)}</span></div>
            <div className="w-full bg-gray-100 rounded-full h-4"><div className="bg-green-500 rounded-full h-4" style={{width:'100%'}}></div></div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1"><span className="text-red-600 font-medium">Expenses</span><span className="font-semibold">Rs. {data.totalExpense?.toFixed(0)}</span></div>
            <div className="w-full bg-gray-100 rounded-full h-4">
              <div className="bg-red-500 rounded-full h-4" style={{width: data.totalIncome > 0 ? `${Math.min((data.totalExpense/data.totalIncome)*100, 100)}%` : '0%'}}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Income breakdown */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-green-500" /> Income Sources</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm bg-green-50 rounded-lg p-3">
              <span className="text-gray-700">Order Sales</span><span className="font-bold text-green-600">Rs. {data.salesIncome?.toFixed(0)}</span>
            </div>
            {data.incomeByType?.map(t => (
              <div key={t.type} className="flex justify-between text-sm bg-gray-50 rounded-lg p-3">
                <span className="text-gray-600">{t.type}</span><span className="font-semibold">Rs. {t.total?.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expense breakdown */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><TrendingDown size={16} className="text-red-500" /> Expense Categories</h3>
          <div className="space-y-2">
            {data.expenseByCategory?.map(e => (
              <div key={e.category} className="flex justify-between text-sm bg-red-50 rounded-lg p-3">
                <span className="text-gray-600">{e.category}</span><span className="font-semibold text-red-600">Rs. {e.total?.toFixed(0)}</span>
              </div>
            ))}
            {data.expenseByCategory?.length === 0 && <p className="text-sm text-gray-400">No expenses</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpenseReport({ data }) {
  const { summary, byCategory, byDate } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600">Rs. {summary.total?.toFixed(0)}</p>
          <p className="text-xs text-gray-400">{summary.count} entries</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Top Category</p>
          <p className="text-2xl font-bold text-gray-800">{byCategory[0]?.category || '—'}</p>
          <p className="text-xs text-gray-400">Rs. {byCategory[0]?.total?.toFixed(0) || 0}</p>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-4">By Category</h3>
          <div className="space-y-3">
            {byCategory.map(c => {
              const pct = summary.total > 0 ? ((c.total / summary.total) * 100).toFixed(0) : 0;
              return (
                <div key={c.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{c.category} ({c.count})</span>
                    <span className="font-semibold">Rs. {c.total?.toFixed(0)} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className="bg-red-500 rounded-full h-2.5" style={{width:`${pct}%`}}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {byDate.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Daily Expenses</h3>
          <div className="flex items-end gap-1 h-36 overflow-x-auto">
            {byDate.map(d => {
              const max = Math.max(...byDate.map(x => x.total), 1);
              const h = Math.max((d.total / max) * 100, 3);
              return (
                <div key={d.date} className="flex-1 min-w-[28px] flex flex-col items-center gap-1">
                  <p className="text-[9px] font-semibold text-gray-600">{(d.total/1000).toFixed(1)}k</p>
                  <div className="w-full bg-red-400 rounded-t-md" style={{height:`${h}%`}}></div>
                  <p className="text-[8px] text-gray-400">{d.date.slice(5)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryReport({ data }) {
  const { summary, items } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Total Items</p>
          <p className="text-2xl font-bold text-gray-800">{summary.totalItems}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Low Stock</p>
          <p className={`text-2xl font-bold ${summary.lowStock > 0 ? 'text-red-600' : 'text-green-600'}`}>{summary.lowStock}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Stock Value</p>
          <p className="text-2xl font-bold text-blue-600">Rs. {summary.totalValue?.toFixed(0)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Item</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">Stock</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">Min</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Unit</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">Cost Price</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">Value</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(i => (
              <tr key={i.id} className={i.is_low ? 'bg-red-50' : 'hover:bg-gray-50'}>
                <td className="px-5 py-3 font-medium text-sm text-gray-800">{i.name}</td>
                <td className={`px-5 py-3 text-right text-sm font-semibold ${i.is_low ? 'text-red-600' : 'text-gray-800'}`}>{i.current_stock}</td>
                <td className="px-5 py-3 text-right text-sm text-gray-500">{i.min_stock}</td>
                <td className="px-5 py-3 text-sm text-gray-500">{i.unit}</td>
                <td className="px-5 py-3 text-right text-sm text-gray-600">Rs. {i.cost_price?.toFixed(2)}</td>
                <td className="px-5 py-3 text-right text-sm font-semibold">Rs. {i.stock_value?.toFixed(0)}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${i.is_low ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {i.is_low ? 'LOW' : 'OK'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerReport({ data }) {
  const { summary, topCustomers } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Total Customers</p>
          <p className="text-2xl font-bold text-gray-800">{summary.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Total Receivable</p>
          <p className="text-2xl font-bold text-red-600">Rs. {summary.total_receivable?.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Total Advance</p>
          <p className="text-2xl font-bold text-green-600">Rs. {summary.total_advance?.toFixed(0)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-700 mb-4">Top Customers by Spending</h3>
        <div className="space-y-2">
          {topCustomers.map((c, i) => (
            <div key={c.name} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">{i+1}</span>
                <div>
                  <p className="font-medium text-sm text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.phone || 'No phone'} · {c.orders} orders</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">Rs. {c.spent?.toFixed(0)}</p>
                {c.balance > 0 && <p className="text-xs text-red-500">Owes Rs.{c.balance?.toFixed(0)}</p>}
              </div>
            </div>
          ))}
          {topCustomers.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No customers yet</p>}
        </div>
      </div>
    </div>
  );
}
