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
        .maybeSingle(); // Use maybeSingle so it doesn't throw if no row found

      if (profileError) throw profileError;

      if (!profileData) {
        // Profile not yet created (e.g. new user via signUp without trigger)
        // Try to create one from user metadata
        const meta = authUser.user_metadata || {};
        if (meta.tenant_id) {
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              full_name: meta.full_name || authUser.email,
              email: authUser.email,
              role: meta.role || 'admin',
              tenant_id: meta.tenant_id,
              is_active: true
            })
            .select()
            .single();
          setProfile(newProfile);
          if (newProfile?.tenant_id) {
            const { data: tenantData } = await supabase
              .from('tenants')
              .select('*')
              .eq('id', newProfile.tenant_id)
              .single();
            if (tenantData) setTenant(tenantData);
          }
        } else {
          // super_admin or unlinked user — set basic profile from auth data
          setProfile({
            id: authUser.id,
            email: authUser.email,
            full_name: authUser.user_metadata?.full_name || authUser.email,
            role: authUser.user_metadata?.role || 'super_admin',
            tenant_id: null
          });
        }
        return;
      }

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
    // Admin with no specific permissions set → grant everything
    if (isAdmin) {
      if (!profile?.permissions || profile.permissions === '[]' || 
          (Array.isArray(profile.permissions) && profile.permissions.length === 0)) {
        return true;
      }
    }
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
