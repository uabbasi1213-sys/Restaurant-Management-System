import { Routes, Route, Navigate } from 'react-router-dom';
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
  const { user, profile, loading } = useAuth();

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

  if (requireSuperAdmin && profile?.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  const { user, profile, loading } = useAuth();

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
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>
            Restaurant Manager
          </p>
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
            ? <Navigate to={profile?.role === 'super_admin' ? '/super-admin' : '/'} replace />
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
            {profile?.role === 'super_admin'
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
