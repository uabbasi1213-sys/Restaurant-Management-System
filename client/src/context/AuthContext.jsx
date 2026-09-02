import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';

const AuthContext = createContext(null);

const isElectron = import.meta.env.VITE_MODE === 'electron';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function localAutoLogin() {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error('Server error: ' + res.status);
  return res.json();
}

async function localLoginWithCredentials(username, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Invalid credentials');
  return data;
}

async function localGetMe(token) {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isElectron) {
      initElectronSession();
    } else {
      initSupabaseSession();
    }
  }, []);

  const initElectronSession = async () => {
    try {
      const stored = localStorage.getItem('desktop_token');
      if (stored) {
        const data = await localGetMe(stored);
        if (data?.user) {
          setUser({ id: data.user.id, username: data.user.username });
          setProfile({ id: data.user.id, username: data.user.username, full_name: data.user.full_name, role: data.user.role, permissions: data.user.permissions || [] });
          setTenant(data.restaurant || null);
          setLoading(false);
          return;
        }
      }
      const data = await localAutoLogin();
      localStorage.setItem('desktop_token', data.token);
      setUser({ id: data.user.id, username: data.user.username });
      setProfile({ id: data.user.id, username: data.user.username, full_name: data.user.full_name, role: data.user.role, permissions: data.user.permissions || [] });
    } catch (err) {
      console.error('[Desktop] Auto-login failed:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const initSupabaseSession = async () => {
    try {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) fetchProfileAndTenant(session.user);
        else setLoading(false);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) await fetchProfileAndTenant(session.user);
        else { setUser(null); setProfile(null); setTenant(null); setLoading(false); }
      });
      return () => subscription.unsubscribe();
    } catch (err) {
      console.error('Supabase init failed:', err);
      setLoading(false);
    }
  };

  const fetchProfileAndTenant = async (authUser) => {
    try {
      setUser(authUser);
      const isSuperUserEmail = authUser.email?.toLowerCase() === 'admin@restaurant.com';

      const { data: profileData, error: profileError } = await supabase
        .from('profiles').select('*').eq('id', authUser.id).maybeSingle();
      if (profileError) throw profileError;

      if (!profileData) {
        const meta = authUser.user_metadata || {};
        if (meta.tenant_id && !isSuperUserEmail) {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles').upsert({ id: authUser.id, full_name: meta.full_name || authUser.email, role: meta.role || 'admin', tenant_id: meta.tenant_id, is_active: true }, { onConflict: 'id' }).select().single();
          if (insertError) {
            setProfile({ id: authUser.id, email: authUser.email, full_name: meta.full_name || authUser.email, role: meta.role || 'admin', tenant_id: meta.tenant_id });
            const { data: tenantData } = await supabase.from('tenants').select('*').eq('id', meta.tenant_id).single();
            if (tenantData) setTenant(tenantData);
          } else {
            setProfile(newProfile);
            if (newProfile?.tenant_id) {
              const { data: tenantData } = await supabase.from('tenants').select('*').eq('id', newProfile.tenant_id).single();
              if (tenantData) setTenant(tenantData);
            }
          }
        } else {
          setProfile({ id: authUser.id, email: authUser.email, full_name: authUser.user_metadata?.full_name || authUser.email, role: 'super_admin', tenant_id: null });
        }
        return;
      }

      // ✅ FIX: admin@restaurant.com HAMESHA super_admin hoga
      if (isSuperUserEmail) {
        setProfile({ ...profileData, email: authUser.email, role: 'super_admin', tenant_id: null });
      } else if (!profileData.tenant_id || profileData.role === 'super_admin') {
        setProfile({ ...profileData, email: authUser.email, role: 'super_admin', tenant_id: null });
      } else {
        setProfile(profileData);
      }
      if (profileData?.tenant_id && !isSuperUserEmail && profileData.role !== 'super_admin') {
        const { data: tenantData, error: tenantError } = await supabase.from('tenants').select('*').eq('id', profileData.tenant_id).single();
        if (!tenantError) setTenant(tenantData);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err.message);
      // ✅ FIX: Profile fetch fail hone par user ko reset karo - white screen prevent
      setUser(null);
      setProfile(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (usernameOrEmail, password) => {
    if (isElectron) {
      const data = await localLoginWithCredentials(usernameOrEmail, password);
      localStorage.setItem('desktop_token', data.token);
      setUser({ id: data.user.id, username: data.user.username });
      setProfile({ id: data.user.id, username: data.user.username, full_name: data.user.full_name, role: data.user.role, permissions: data.user.permissions || [] });
      return data;
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email: usernameOrEmail, password });
      if (error) throw new Error(error.message);
      return data;
    }
  };

  const logout = async () => {
    if (isElectron) {
      localStorage.removeItem('desktop_token');
      setUser(null); setProfile(null); setTenant(null);
    } else {
      await supabase.auth.signOut();
    }
  };

  const updateTenant = (data) => setTenant(data);
  // ✅ FIX: profile null hone par isSuperAdmin kabhi true nahi hoga (routing loop prevent)
  const isSuperAdmin = !!profile && (
    profile?.role === 'super_admin' ||
    profile?.role === 'Super Admin' ||
    user?.email?.toLowerCase() === 'admin@restaurant.com'
  );
  const isAdmin = profile?.role === 'admin' || profile?.role === 'Admin' || isSuperAdmin;

  const hasPermission = (perm) => {
    if (isSuperAdmin) return true;
    if (isAdmin) {
      if (!profile?.permissions || (Array.isArray(profile.permissions) && profile.permissions.length === 0)) return true;
    }
    if (!profile?.permissions) return false;
    const perms = Array.isArray(profile.permissions) ? profile.permissions : JSON.parse(profile.permissions || '[]');
    return perms.includes(perm) || perms.includes('all');
  };

  return (
    <AuthContext.Provider value={{ user, profile, tenant, loading, login, logout, updateTenant, isSuperAdmin, isAdmin, hasPermission, isElectron }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
