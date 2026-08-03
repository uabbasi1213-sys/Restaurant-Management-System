import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { Menu, LogOut } from 'lucide-react';

export default function Layout() {
  const { tenant, profile, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    setShowUserMenu(false);
    if (window.confirm('Kya aap logout karna chahte hain?')) {
      logout();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b px-4 md:px-6 py-3 flex items-center justify-between">
          {/* Hamburger - mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors mr-3"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          <h2 className="text-base md:text-lg font-semibold text-gray-700 truncate flex-1">
            {tenant?.name || 'Restaurant Management System'}
          </h2>

          {/* User Avatar + Logout (top right) */}
          <div className="relative ml-3">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {(profile?.full_name || profile?.email || 'U')[0].toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-gray-800 leading-tight">
                  {profile?.full_name || profile?.email || 'User'}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {profile?.role || 'staff'}
                </p>
              </div>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <p className="text-sm font-bold text-gray-800 truncate">
                      {profile?.full_name || profile?.email}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{profile?.role || 'staff'}</p>
                    {tenant?.name && (
                      <p className="text-xs text-orange-600 font-medium mt-0.5">{tenant.name}</p>
                    )}
                  </div>
                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
