import { useAuth } from '../context/AuthContext';
import { Users, ShoppingCart, DollarSign, AlertTriangle } from 'lucide-react';

const stats = [
  { label: "Today's Sales", value: 'Rs. 0', icon: DollarSign, color: 'bg-green-500' },
  { label: 'Orders', value: '0', icon: ShoppingCart, color: 'bg-blue-500' },
  { label: 'Users', value: '-', icon: Users, color: 'bg-purple-500' },
  { label: 'Low Stock', value: '0', icon: AlertTriangle, color: 'bg-red-500' },
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500">Welcome back, {user?.full_name || user?.username}!</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(stat => (
          <div key={stat.label} className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div className={`${stat.color} p-3 rounded-xl`}>
              <stat.icon size={24} className="text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-xl font-bold text-gray-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-3">System Progress</h3>
        <p className="text-gray-500 text-sm mb-4">
          Phase 1 is complete — User Management &amp; Restaurant Settings are ready. 
          More modules coming in upcoming phases.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            '✅ User Management',
            '✅ Settings',
            '✅ Audit Logs',
            '⏳ Menu Management',
            '⏳ Inventory',
            '⏳ POS System',
            '⏳ Kitchen Display',
            '⏳ Reports'
          ].map(item => (
            <div key={item} className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
