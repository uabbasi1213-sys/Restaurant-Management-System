import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Building2, Plus, Users, CheckCircle, XCircle,
  Trash2, Edit3, Key, ChevronRight, TrendingUp,
  Activity, Crown, MoreVertical, Search, RefreshCw
} from 'lucide-react';

export default function SuperAdmin() {
  const { profile } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ total: 0, active: 0, suspended: 0 });

  // Add Tenant Form
  const [form, setForm] = useState({
    name: '', slug: '', address: '', phone: '', subscription_plan: 'basic'
  });
  // Add User Form
  const [userForm, setUserForm] = useState({
    full_name: '', email: '', password: '', role: 'admin'
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => { fetchTenants(); }, []);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*, profiles(count)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTenants(data || []);
      const active = (data || []).filter(t => t.subscription_status === 'active').length;
      const suspended = (data || []).filter(t => t.subscription_status === 'suspended').length;
      setStats({ total: data?.length || 0, active, suspended });
    } catch (err) {
      toast.error('Failed to load clients: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleAddTenant = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const slug = form.slug || generateSlug(form.name);
      const { data, error } = await supabase
        .from('tenants')
        .insert([{ ...form, slug, is_active: true, subscription_status: 'active' }])
        .select()
        .single();
      if (error) throw error;
      toast.success(`✅ Client "${data.name}" added successfully!`);
      setShowAddModal(false);
      setForm({ name: '', slug: '', address: '', phone: '', subscription_plan: 'basic' });
      fetchTenants();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: userForm.email,
        password: userForm.password,
        user_metadata: {
          full_name: userForm.full_name,
          tenant_id: selectedTenant.id,
          role: userForm.role
        },
        email_confirm: true
      });
      if (error) throw error;
      toast.success(`✅ User "${userForm.full_name}" created for ${selectedTenant.name}!`);
      setShowUserModal(false);
      setUserForm({ full_name: '', email: '', password: '', role: 'admin' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const toggleTenantStatus = async (tenant) => {
    const newStatus = tenant.subscription_status === 'active' ? 'suspended' : 'active';
    const { error } = await supabase
      .from('tenants')
      .update({ subscription_status: newStatus })
      .eq('id', tenant.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Client ${newStatus === 'active' ? 'activated' : 'suspended'}!`);
    fetchTenants();
  };

  const deleteTenant = async (tenant) => {
    if (!window.confirm(`Delete "${tenant.name}"? This will remove ALL data for this client!`)) return;
    const { error } = await supabase.from('tenants').delete().eq('id', tenant.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Client deleted!');
    fetchTenants();
  };

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const planColors = { basic: '#6366f1', pro: '#f97316', enterprise: '#10b981' };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a14', color: 'white', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(139,92,246,0.08))',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px',
            background: 'linear-gradient(135deg, #f97316, #dc2626)',
            borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(249,115,22,0.35)'
          }}>
            <Crown size={22} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Super Admin Panel</h1>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>
              Restaurant Management SaaS Platform
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '11px 22px',
            background: 'linear-gradient(135deg, #f97316, #dc2626)',
            border: 'none', borderRadius: '12px',
            color: 'white', fontSize: '14px', fontWeight: '600',
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(249,115,22,0.3)'
          }}
        >
          <Plus size={18} /> Add New Client
        </button>
      </div>

      <div style={{ padding: '32px' }}>
        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
          {[
            { label: 'Total Clients', value: stats.total, icon: Building2, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
            { label: 'Active Clients', value: stats.active, icon: CheckCircle, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
            { label: 'Suspended', value: stats.suspended, icon: XCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
          ].map((s, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px', padding: '24px',
              display: 'flex', alignItems: 'center', gap: '16px'
            }}>
              <div style={{
                width: '52px', height: '52px', background: s.bg,
                borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <s.icon size={24} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: '30px', fontWeight: '700', color: 'white' }}>{s.value}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Search + Refresh */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '11px 14px 11px 42px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', color: 'white',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          <button onClick={fetchTenants} style={{
            padding: '11px 16px', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
            color: 'rgba(255,255,255,0.7)', cursor: 'pointer'
          }}>
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Clients Table */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px', overflow: 'hidden'
        }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            padding: '14px 20px',
            background: 'rgba(255,255,255,0.04)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontSize: '12px', color: 'rgba(255,255,255,0.4)',
            fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            <span>Client / Restaurant</span>
            <span>Plan</span>
            <span>Status</span>
            <span>Joined</span>
            <span>Actions</span>
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
              Loading clients...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <Building2 size={40} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: '12px' }} />
              <p style={{ color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                {searchQuery ? 'No clients found' : 'No clients yet. Add your first client!'}
              </p>
            </div>
          ) : filtered.map((tenant, idx) => (
            <div key={tenant.id} style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
              padding: '16px 20px', alignItems: 'center',
              borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              transition: 'background 0.15s'
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Name */}
              <div>
                <div style={{ fontWeight: '600', fontSize: '15px' }}>{tenant.name}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                  {tenant.phone || tenant.slug}
                </div>
              </div>
              {/* Plan */}
              <span style={{
                display: 'inline-block', padding: '4px 12px',
                background: `${planColors[tenant.subscription_plan] || '#6366f1'}20`,
                color: planColors[tenant.subscription_plan] || '#6366f1',
                borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                textTransform: 'capitalize'
              }}>
                {tenant.subscription_plan || 'basic'}
              </span>
              {/* Status */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 12px',
                background: tenant.subscription_status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                color: tenant.subscription_status === 'active' ? '#10b981' : '#ef4444',
                borderRadius: '20px', fontSize: '12px', fontWeight: '600'
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: tenant.subscription_status === 'active' ? '#10b981' : '#ef4444'
                }} />
                {tenant.subscription_status === 'active' ? 'Active' : 'Suspended'}
              </span>
              {/* Date */}
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>
                {new Date(tenant.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => { setSelectedTenant(tenant); setShowUserModal(true); }}
                  title="Add User"
                  style={{
                    padding: '7px', background: 'rgba(99,102,241,0.15)',
                    border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px',
                    color: '#818cf8', cursor: 'pointer'
                  }}
                >
                  <Users size={14} />
                </button>
                <button
                  onClick={() => toggleTenantStatus(tenant)}
                  title={tenant.subscription_status === 'active' ? 'Suspend' : 'Activate'}
                  style={{
                    padding: '7px',
                    background: tenant.subscription_status === 'active' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                    border: `1px solid ${tenant.subscription_status === 'active' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                    borderRadius: '8px',
                    color: tenant.subscription_status === 'active' ? '#f87171' : '#34d399',
                    cursor: 'pointer'
                  }}
                >
                  {tenant.subscription_status === 'active' ? <XCircle size={14} /> : <CheckCircle size={14} />}
                </button>
                <button
                  onClick={() => deleteTenant(tenant)}
                  title="Delete Client"
                  style={{
                    padding: '7px', background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px',
                    color: '#f87171', cursor: 'pointer'
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ============ ADD TENANT MODAL ============ */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#13131f', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px', padding: '36px', width: '100%', maxWidth: '460px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
          }}>
            <h2 style={{ margin: '0 0 24px', fontSize: '20px', fontWeight: '700' }}>
              Add New Client Restaurant
            </h2>
            <form onSubmit={handleAddTenant}>
              {[
                { label: 'Restaurant Name *', key: 'name', placeholder: 'Pizza Palace', type: 'text', required: true },
                { label: 'Slug (auto-generated)', key: 'slug', placeholder: 'pizza-palace', type: 'text' },
                { label: 'Phone', key: 'phone', placeholder: '+92 300 1234567', type: 'text' },
                { label: 'Address', key: 'address', placeholder: 'Lahore, Pakistan', type: 'text' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    required={f.required}
                    value={form[f.key]}
                    placeholder={f.placeholder}
                    onChange={e => {
                      const val = e.target.value;
                      setForm(prev => ({
                        ...prev,
                        [f.key]: val,
                        ...(f.key === 'name' && !prev.slug ? { slug: generateSlug(val) } : {})
                      }));
                    }}
                    style={{
                      width: '100%', padding: '12px 14px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px', color: 'white',
                      fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              ))}

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  Subscription Plan
                </label>
                <select
                  value={form.subscription_plan}
                  onChange={e => setForm(p => ({ ...p, subscription_plan: e.target.value }))}
                  style={{
                    width: '100%', padding: '12px 14px',
                    background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none'
                  }}
                >
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{
                  flex: 1, padding: '13px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px', color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer', fontWeight: '600'
                }}>Cancel</button>
                <button type="submit" disabled={formLoading} style={{
                  flex: 2, padding: '13px',
                  background: 'linear-gradient(135deg, #f97316, #dc2626)',
                  border: 'none', borderRadius: '12px',
                  color: 'white', fontWeight: '700',
                  cursor: formLoading ? 'not-allowed' : 'pointer',
                  opacity: formLoading ? 0.7 : 1
                }}>
                  {formLoading ? 'Creating...' : '+ Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ ADD USER MODAL ============ */}
      {showUserModal && selectedTenant && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#13131f', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px', padding: '36px', width: '100%', maxWidth: '460px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
          }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '700' }}>
              Add User to Client
            </h2>
            <p style={{ margin: '0 0 24px', color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>
              Adding user for: <strong style={{ color: '#f97316' }}>{selectedTenant.name}</strong>
            </p>
            <form onSubmit={handleAddUser}>
              {[
                { label: 'Full Name *', key: 'full_name', placeholder: 'Ahmed Khan', type: 'text', required: true },
                { label: 'Email Address *', key: 'email', placeholder: 'ahmed@restaurant.com', type: 'email', required: true },
                { label: 'Password *', key: 'password', placeholder: 'Min 6 characters', type: 'password', required: true },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    required={f.required}
                    value={userForm[f.key]}
                    placeholder={f.placeholder}
                    onChange={e => setUserForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{
                      width: '100%', padding: '12px 14px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px', color: 'white',
                      fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              ))}

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  Role
                </label>
                <select
                  value={userForm.role}
                  onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}
                  style={{
                    width: '100%', padding: '12px 14px',
                    background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none'
                  }}
                >
                  <option value="admin">Admin (Full access)</option>
                  <option value="manager">Manager</option>
                  <option value="staff">Staff / Cashier</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowUserModal(false)} style={{
                  flex: 1, padding: '13px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px', color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer', fontWeight: '600'
                }}>Cancel</button>
                <button type="submit" disabled={formLoading} style={{
                  flex: 2, padding: '13px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none', borderRadius: '12px',
                  color: 'white', fontWeight: '700',
                  cursor: formLoading ? 'not-allowed' : 'pointer',
                  opacity: formLoading ? 0.7 : 1
                }}>
                  {formLoading ? 'Creating...' : '+ Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
