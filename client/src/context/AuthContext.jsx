import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfileAndTenant(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          await fetchProfileAndTenant(session.user);
        } else {
          setUser(null);
          setProfile(null);
          setTenant(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfileAndTenant = async (authUser) => {
    try {
      setUser(authUser);

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch tenant if not super_admin (or fetch own tenant)
      if (profileData?.tenant_id) {
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', profileData.tenant_id)
          .single();
        if (!tenantError) setTenant(tenantData);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const updateTenant = (data) => setTenant(data);

  const isSuperAdmin = profile?.role === 'super_admin';
  const isAdmin = profile?.role === 'admin' || isSuperAdmin;
  const hasPermission = (perm) => {
    if (isSuperAdmin) return true;
    if (!profile?.permissions) return false;
    const perms = Array.isArray(profile.permissions) ? profile.permissions : JSON.parse(profile.permissions || '[]');
    return perms.includes(perm) || perms.includes('all');
  };

  return (
    <AuthContext.Provider value={{
      user, profile, tenant, loading,
      login, logout, updateTenant,
      isSuperAdmin, isAdmin, hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
