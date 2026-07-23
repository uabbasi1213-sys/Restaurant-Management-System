import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, Settings, FileText, FolderOpen, UtensilsCrossed, Package, Truck, ShoppingCart, Monitor, ClipboardList, ChefHat, UserCheck, TrendingDown, TrendingUp, CalendarCheck, BarChart3, Database, X } from 'lucide-react';

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
  { to: '/customers', label: 'Customers', icon: UserCheck, permission: 'customers' },
  { to: '/expenses', label: 'Expenses', icon: TrendingDown, permission: 'expenses' },
  { to: '/income', label: 'Income', icon: TrendingUp, permission: 'income' },
  { to: '/daily-closing', label: 'Daily Closing', icon: CalendarCheck, permission: 'daily_closing' },
  { to: '/reports', label: 'Reports', icon: BarChart3, permission: 'reports' },
  { to: '/backups', label: 'Backup & System', icon: Database, permission: 'backups' },
  { to: '/settings', label: 'Settings', icon: Settings, permission: 'settings' },
  { to: '/audit-logs', label: 'Audit Logs', icon: FileText, permission: 'audit_logs', superAdminOnly: true },
];

export default function Sidebar({ isOpen, onClose }) {
  const { tenant, hasPermission, isSuperAdmin } = useAuth();

  const links = allLinks.filter(link => {
    if (link.superAdminOnly) return isSuperAdmin;
    return hasPermission(link.permission);
  });

  return (
    <>
      {/* Mobile Overlay - dark background jab sidebar open ho */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-slate-900 text-white flex flex-col z-40
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0 md:flex md:z-auto
        `}
      >
        {/* Header with close button on mobile */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {tenant?.logo ? (
                <img src={tenant.logo} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                  {(tenant?.name || 'R')[0]}
                </div>
              )}
              <div>
                <h1 className="font-bold text-sm leading-tight">{tenant?.name || 'Restaurant'}</h1>
                <p className="text-xs text-slate-400">Management System</p>
              </div>
            </div>
            {/* Close button - sirf mobile pe dikhega */}
            <button
              onClick={onClose}
              className="md:hidden p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              onClick={onClose} // Link click hone par mobile pe sidebar band ho
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
    </>
  );
}
