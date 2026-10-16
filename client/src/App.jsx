import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

const isElectron = import.meta.env.VITE_MODE === 'electron';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import SuperAdmin from './pages/SuperAdmin';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Settings from './pages/Settings';
import AuditLogs from './pages/AuditLogs';
import MenuCategories from './pages/MenuCategories';
import MenuItems from './pages/MenuItems';
import Inventory from './pages/Inventory';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import POS from './pages/POS';
import Orders from './pages/Orders';
import Kitchen from './pages/Kitchen';
import Customers from './pages/Customers';
import Expenses from './pages/Expenses';
import Income from './pages/Income';
import DailyClosing from './pages/DailyClosing';
import Reports from './pages/Reports';
import Backups from './pages/Backups';

function PrivateRoute({ children, requireSuperAdmin = false }) {
  const { user, isSuperAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0a14'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px', height: '48px', margin: '0 auto 16px',
            border: '3px solid rgba(249,115,22,0.2)',
            borderTopColor: '#f97316',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Electron desktop: no super-admin panel
  if (isElectron && requireSuperAdmin) return <Navigate to="/" replace />;

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  const { user, isSuperAdmin, loading } = useAuth();
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => {
        setShowTroubleshoot(true);
      }, 2500);
    } else {
      setShowTroubleshoot(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0a14', padding: '16px'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '320px' }}>
          <div style={{
            width: '48px', height: '48px', margin: '0 auto 16px',
            border: '3px solid rgba(249,115,22,0.2)',
            borderTopColor: '#f97316',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', fontWeight: 500, margin: 0 }}>
            Restaurant Manager
          </p>
          {showTroubleshoot && (
            <div style={{ marginTop: '20px' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '12px' }}>
                Taking longer than usual to connect?
              </p>
              <button
                onClick={() => {
                  try {
                    localStorage.clear();
                    sessionStorage.clear();
                  } catch (e) {}
                  window.location.href = '/login';
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f97316',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'opacity 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = '0.85')}
                onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Reset Session & Login
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Login Page */}
      <Route
        path="/login"
        element={
          user
            ? (isSuperAdmin ? <Navigate to="/super-admin" replace /> : <Navigate to="/" replace />)
            : <Login />
        }
      />

      {/* Super Admin Panel */}
      <Route
        path="/super-admin"
        element={
          <PrivateRoute requireSuperAdmin>
            <SuperAdmin />
          </PrivateRoute>
        }
      />

      {/* Restaurant App Routes (for tenant users) */}
      <Route
        element={
          <PrivateRoute>
            {isSuperAdmin
              ? <Navigate to="/super-admin" replace />
              : <Layout />
            }
          </PrivateRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
        <Route path="/menu/categories" element={<MenuCategories />} />
        <Route path="/menu/items" element={<MenuItems />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/kitchen" element={<Kitchen />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/income" element={<Income />} />
        <Route path="/daily-closing" element={<DailyClosing />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/backups" element={<Backups />} />
      </Route>

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
