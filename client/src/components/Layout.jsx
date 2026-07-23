import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { Menu } from 'lucide-react';

export default function Layout() {
  const { tenant } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b px-4 md:px-6 py-3 flex items-center justify-between">
          {/* Hamburger Button - sirf mobile pe dikhega */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors mr-3"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          <h2 className="text-base md:text-lg font-semibold text-gray-700 truncate">
            {tenant?.name || 'Restaurant Management System'}
          </h2>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
