import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';

const AuthContext = createContext(null);

const isElectron = import.meta.env.VITE_MODE === 'electron';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function isValidUUID(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

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
      const cleanup = initSupabaseSession();
      return cleanup;
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

  const initSupabaseSession = () => {
    let isSubscribed = true;

    // Safety timeout: Never keep the user stuck on a loading screen
    const timer = setTimeout(() => {
      if (isSubscribed) {
        console.warn('[Auth] Session initialization timed out, releasing loading state.');
        setLoading(false);
      }
    }, 4000);

    const init = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[Auth] getSession error:', error.message);
          if (error.message?.includes('Refresh Token') || error.message?.includes('invalid')) {
            try { await supabase.auth.signOut(); } catch {}
          }
          if (isSubscribed) {
            setUser(null);
            setProfile(null);
            setTenant(null);
            setLoading(false);
          }
          return;
        }

        if (session?.user && isSubscribed) {
          await fetchProfileAndTenant(session.user);
        } else if (isSubscribed) {
          setUser(null);
          setProfile(null);
          setTenant(null);
          setLoading(false);
        }
      } catch (err) {
        console.error('[Auth] getSession failed:', err);
        if (isSubscribed) setLoading(false);
      } finally {
        clearTimeout(timer);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isSubscribed) return;
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setTenant(null);
        setLoading(false);
      } else if (session?.user) {
        // Run decoupled from auth dispatcher to prevent Supabase query deadlocks
        setTimeout(() => {
          if (isSubscribed) fetchProfileAndTenant(session.user);
        }, 0);
      } else {
        setUser(null);
        setProfile(null);
        setTenant(null);
        setLoading(false);
      }
    });

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
      subscription?.unsubscribe();
    };
  };

  const fetchProfileAndTenant = async (authUser) => {
    try {
      const isSuperUserEmail = authUser.email?.toLowerCase() === 'admin@restaurant.com';
      const metaTenantId = authUser.user_metadata?.tenant_id;
      const defaultTenantId = (metaTenantId && isValidUUID(metaTenantId))
        ? metaTenantId
        : (localStorage.getItem('tenant_id') || null);

      if (metaTenantId) {
        localStorage.setItem('tenant_id', metaTenantId);
      }

      // Default Admin Profile to guarantee full access and avoid "Staff" lock
      const defaultAdminProfile = {
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Admin',
        role: isSuperUserEmail ? 'super_admin' : 'admin',
        permissions: ['all'],
        tenant_id: isSuperUserEmail ? null : (metaTenantId || defaultTenantId),
        is_active: true
      };

      let profileData = null;
      try {
        const profilePromise = supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Profile query timeout')), 3500));
        const res = await Promise.race([profilePromise, timeoutPromise]);
        profileData = res?.data;
      } catch (e) {
        console.warn('[Auth] Remote profile query slow or failed, using admin fallback:', e.message);
      }

      if (!profileData) {
        const meta = authUser.user_metadata || {};
        if (meta.tenant_id && !isSuperUserEmail) {
          try {
            const { data: newProfile } = await supabase
              .from('profiles')
              .upsert({ id: authUser.id, full_name: meta.full_name || authUser.email, role: 'admin', tenant_id: meta.tenant_id, is_active: true }, { onConflict: 'id' })
              .select().single();
            if (newProfile) profileData = newProfile;
          } catch {}
        }
      }

      if (profileData) {
        if (profileData.tenant_id) {
          localStorage.setItem('tenant_id', profileData.tenant_id);
        }

        if (isSuperUserEmail || profileData.role === 'super_admin' || !profileData.tenant_id) {
          setProfile({ ...profileData, email: authUser.email, role: 'super_admin', tenant_id: null });
        } else {
          // Guarantee admin role and full permissions for restaurant manager
          setProfile({
            ...profileData,
            email: authUser.email,
            role: profileData.role || 'admin',
            permissions: (profileData.permissions && profileData.permissions.length > 0) ? profileData.permissions : ['all']
          });
        }

        if (profileData.tenant_id && !isSuperUserEmail) {
          try {
            const { data: tenantData } = await supabase.from('tenants').select('*').eq('id', profileData.tenant_id).single();
            if (tenantData) setTenant(tenantData);
          } catch {}
        }
      } else {
        // Use default admin profile
        setProfile(defaultAdminProfile);
        if (defaultAdminProfile.tenant_id && !isSuperUserEmail) {
          localStorage.setItem('tenant_id', defaultAdminProfile.tenant_id);
          try {
            const { data: tenantData } = await supabase.from('tenants').select('*').eq('id', defaultAdminProfile.tenant_id).single();
            if (tenantData) setTenant(tenantData);
            else setTenant({ id: defaultAdminProfile.tenant_id, name: 'Restaurant Management System' });
          } catch {
            setTenant({ id: defaultAdminProfile.tenant_id, name: 'Restaurant Management System' });
          }
        }
      }

      // Synchronously set user along with profile
      setUser(authUser);
    } catch (err) {
      console.error('Failed to fetch profile:', err.message);
      // Guarantee fallback admin state instead of blank/locked screen
      setUser(authUser);
      const fallbackTenant = authUser.user_metadata?.tenant_id || localStorage.getItem('tenant_id') || null;
      setProfile({
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || 'Admin',
        role: 'admin',
        permissions: ['all'],
        tenant_id: fallbackTenant
      });
      setTenant({ id: fallbackTenant, name: authUser.user_metadata?.full_name ? `${authUser.user_metadata.full_name}'s Restaurant` : 'Restaurant Management System' });
    } finally {
      setLoading(false);
    }
  };

  const login = async (usernameOrEmail, password) => {
    if (isElectron) {
      const data = await localLoginWithCredentials(usernameOrEmail, password);
      localStorage.setItem('desktop_token', data.token);
      setUser({ id: data.user.id, username: data.user.username });
      setProfile({ id: data.user.id, username: data.user.username, full_name: data.user.full_name, role: data.user.role || 'admin', permissions: data.user.permissions || ['all'] });
      return data;
    } else {
      let emailToUse = (usernameOrEmail || '').trim();
      // Map username to known email if needed
      if (!emailToUse.includes('@')) {
        const lower = emailToUse.toLowerCase();
        if (lower === 'admin') {
          emailToUse = 'admin@restaurant.com';
        } else if (lower === 'umar') {
          emailToUse = 'umarriaz7278@gmail.com';
        } else {
          emailToUse = `${lower}@restaurant.com`;
        }
      }

      try {
        const authPromise = supabase.auth.signInWithPassword({ email: emailToUse, password });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Sign-in request timed out. Please check your network and try again.')), 8000)
        );

        const { data, error } = await Promise.race([authPromise, timeoutPromise]);
        if (error) {
          // If username mapping failed, try common email domain as fallback
          if (!usernameOrEmail.includes('@') && emailToUse !== `${usernameOrEmail.trim().toLowerCase()}@gmail.com`) {
            try {
              const alt = await supabase.auth.signInWithPassword({ email: `${usernameOrEmail.trim().toLowerCase()}@gmail.com`, password });
              if (!alt.error && alt.data) {
                if (alt.data.user) await fetchProfileAndTenant(alt.data.user);
                return alt.data;
              }
            } catch {}
          }
          throw new Error(error.message);
        }
        if (data?.user) {
          await fetchProfileAndTenant(data.user);
        }
        return data;
      } catch (err) {
        throw new Error(err.message || 'Invalid credentials');
      }
    }
  };

  const logout = async () => {
    if (isElectron) {
      localStorage.removeItem('desktop_token');
      setUser(null); setProfile(null); setTenant(null);
    } else {
      await supabase.auth.signOut();
      setUser(null); setProfile(null); setTenant(null);
      localStorage.removeItem('tenant_id');
    }
  };

  const updateTenant = (data) => setTenant(data);

  // Full Admin Access: Admin has all permissions, no lockout
  const isSuperAdmin = !!profile && (
    profile?.role === 'super_admin' ||
    profile?.role === 'Super Admin' ||
    user?.email?.toLowerCase() === 'admin@restaurant.com'
  );

  const isAdmin = isSuperAdmin || !profile?.role || profile?.role === 'admin' || profile?.role === 'Admin' || profile?.role === 'owner';

  const hasPermission = (perm) => {
    if (isSuperAdmin || isAdmin) return true;
    if (!profile?.permissions) return true;
    const perms = Array.isArray(profile.permissions) ? profile.permissions : JSON.parse(profile.permissions || '[]');
    if (perms.length === 0 || perms.includes('all') || perms.includes(perm)) return true;
    return perms.includes(perm);
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
