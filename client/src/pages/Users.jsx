import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, UserCheck, UserX } from 'lucide-react';

export default function Users() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role_id: '', is_active: true });

  useEffect(() => { if (profile?.tenant_id) loadData(); }, [profile?.tenant_id]);

  const loadData = async () => {
    try {
      const { data: usersData, error: uErr } = await supabase
        .from('profiles')
        .select(`*, roles (name)`)
        .eq('tenant_id', profile.tenant_id);
      
      if (uErr) { toast.error(uErr.message); return; }
      
      const { data: rolesData, error: rErr } = await supabase
        .from('roles')
        .select('*');

      if (rErr) { toast.error(rErr.message); return; }

      const mappedUsers = usersData?.map(u => ({
        ...u,
        role_name: u.roles?.name || 'Unknown'
      })) || [];

      setUsers(mappedUsers);
      setRoles(rolesData || []);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openAdd = () => {
    toast.error('New users must be created from the Super Admin panel.');
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({
      username: user.username,
      password: '',
      full_name: user.full_name || '',
      role_id: user.role_id,
      is_active: !!user.is_active
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: form.full_name,
            role_id: form.role_id,
            is_active: form.is_active
          })
          .eq('id', editing.id);
          
        if (error) { toast.error(error.message); return; }
        toast.success('User updated');
      } else {
        toast.error('New users must be created from the Super Admin panel.');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (user) => {
    if (!confirm(`Delete user "${user.username || user.full_name}"?`)) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);
        
      if (error) { toast.error(error.message); return; }
      toast.success('User deleted');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
          <p className="text-gray-500 text-sm">{users.length} total users</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-medium transition">
          <Plus size={18} /> Add User
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Created</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-800">{user.full_name || user.username}</p>
                    <p className="text-sm text-gray-500">@{user.username}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-medium">
                      {user.role_name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.is_active ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <UserCheck size={14} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-500 text-sm">
                        <UserX size={14} /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEdit(user)} className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50 mr-1">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(user)} className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-semibold">{editing ? 'Edit User' : 'Add New User'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm({...form, full_name: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm({...form, username: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="Username"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editing ? '(leave blank to keep)' : '*'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder={editing ? 'Leave blank to keep current' : 'Password'}
                  required={!editing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  value={form.role_id}
                  onChange={e => setForm({...form, role_id: parseInt(e.target.value)})}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  required
                >
                  <option value="">Select Role</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              {editing && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={e => setForm({...form, is_active: e.target.checked})}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-medium">
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
