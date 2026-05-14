import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { LogOut, User } from 'lucide-react';

export default function Layout() {
  const { user, restaurant, logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b px-6 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700">
            {restaurant?.name || 'Restaurant Management System'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User size={16} />
              <span>{user?.full_name || user?.username}</span>
              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-medium">
                {user?.role}
              </span>
            </div>
            <button onClick={logout} className="flex items-center gap-1 text-red-500 hover:text-red-700 text-sm">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
