import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, Settings, FileText, FolderOpen, UtensilsCrossed, Package, Truck, ShoppingCart, Monitor, ClipboardList, ChefHat } from 'lucide-react';

const allLinks = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard' },
  { to: '/users', label: 'Users', icon: Users, permission: 'users' },
  { to: '/menu/categories', label: 'Categories', icon: FolderOpen, permission: 'menu' },
  { to: '/menu/items', label: 'Menu Items', icon: UtensilsCrossed, permission: 'menu' },
  { to: '/inventory', label: 'Inventory', icon: Package, permission: 'inventory' },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, permission: 'suppliers' },
  { to: '/purchases', label: 'Purchases', icon: ShoppingCart, permission: 'purchases' },
  { to: '/pos', label: 'POS / Billing', icon: Monitor, permission: 'pos' },
  { to: '/orders', label: 'Orders', icon: ClipboardList, permission: 'orders' },
  { to: '/kitchen', label: 'Kitchen (KDS)', icon: ChefHat, permission: 'kitchen' },
  { to: '/settings', label: 'Settings', icon: Settings, permission: 'settings' },
  { to: '/audit-logs', label: 'Audit Logs', icon: FileText, permission: 'audit_logs', superAdminOnly: true },
];

export default function Sidebar() {
  const { user, restaurant } = useAuth();
  const permissions = user?.permissions || [];
  const isSuperAdmin = permissions.includes('all');

  const links = allLinks.filter(link => {
    if (link.superAdminOnly) return isSuperAdmin;
    if (isSuperAdmin) return true;
    return permissions.includes(link.permission);
  });

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col min-h-screen">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          {restaurant?.logo ? (
            <img src={restaurant.logo} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              {(restaurant?.name || 'R')[0]}
            </div>
          )}
          <div>
            <h1 className="font-bold text-sm leading-tight">{restaurant?.name || 'Restaurant'}</h1>
            <p className="text-xs text-slate-400">Management System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <link.icon size={18} />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700 text-xs text-slate-500">
        Restaurant MS v1.0
      </div>
    </aside>
  );
}
