import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { UtensilsCrossed, User, Lock, Monitor } from 'lucide-react';

const isElectron = import.meta.env.VITE_MODE === 'electron';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast.success('Login successful!');
    } catch (err) {
      toast.error(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '16px',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)'
    }}>
      {/* Animated background blobs */}
      <div style={{
        position: 'fixed', top: '10%', left: '15%', width: '300px', height: '300px',
        borderRadius: '50%', background: 'rgba(251,146,60,0.08)',
        filter: 'blur(80px)', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'fixed', bottom: '15%', right: '10%', width: '400px', height: '400px',
        borderRadius: '50%', background: 'rgba(139,92,246,0.07)',
        filter: 'blur(100px)', pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%', maxWidth: '440px',
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px', padding: '48px 40px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '72px', height: '72px',
            background: 'linear-gradient(135deg, #f97316, #dc2626)',
            borderRadius: '20px', marginBottom: '16px',
            boxShadow: '0 8px 24px rgba(249,115,22,0.4)'
          }}>
            <UtensilsCrossed size={36} color="white" />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: 'white', margin: '0 0 8px' }}>
            Restaurant Manager
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
            {isElectron ? '💻 Desktop Edition — Offline' : 'SaaS Platform — Sign in to continue'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Username field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block', color: 'rgba(255,255,255,0.7)',
              fontSize: '13px', fontWeight: '500', marginBottom: '8px'
            }}>
              Username or Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{
                position: 'absolute', left: '14px', top: '50%',
                transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)'
              }} />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                placeholder="admin or you@restaurant.com"
                style={{
                  width: '100%', padding: '14px 14px 14px 44px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px', color: 'white', fontSize: '15px',
                  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(249,115,22,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>
          </div>

          {/* Password field */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{
              display: 'block', color: 'rgba(255,255,255,0.7)',
              fontSize: '13px', fontWeight: '500', marginBottom: '8px'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{
                position: 'absolute', left: '14px', top: '50%',
                transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)'
              }} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '14px 14px 14px 44px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px', color: 'white', fontSize: '15px',
                  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(249,115,22,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '15px',
              background: loading
                ? 'rgba(249,115,22,0.5)'
                : 'linear-gradient(135deg, #f97316, #dc2626)',
              border: 'none', borderRadius: '12px',
              color: 'white', fontSize: '16px', fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 8px 24px rgba(249,115,22,0.35)'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>
        </form>

        {/* Footer badge */}
        <div style={{
          marginTop: '24px', padding: '16px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px', textAlign: 'center'
        }}>
          {isElectron ? (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>
              <Monitor size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
              Offline Desktop App • Data saved locally on this computer
            </p>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>
              ☁️ Cloud SaaS Edition • Online Real-time Database
            </p>
          )}
        </div>

        {/* Credentials hint */}
        <div style={{
          marginTop: '12px', padding: '12px 16px',
          background: 'rgba(249,115,22,0.08)',
          border: '1px solid rgba(249,115,22,0.2)',
          borderRadius: '10px', textAlign: 'center'
        }}>
          <p style={{ color: 'rgba(255,200,100,0.85)', fontSize: '12px', margin: 0 }}>
            Admin Login: <strong style={{ color: 'rgba(249,180,80,1)' }}>admin</strong> or your registered email
          </p>
        </div>
      </div>
    </div>
  );
}
