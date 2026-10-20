import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Upload, Save } from 'lucide-react';

export default function Settings() {
  const { restaurant, tenant, updateRestaurant, updateTenant, profile } = useAuth();
  const currentRestaurant = restaurant || tenant;
  const updateProfile = updateRestaurant || updateTenant;
  const [form, setForm] = useState({ name: '', address: '', phone: '', ntn: '', strn: '' });
  const [logoPreview, setLogoPreview] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentRestaurant) {
      setForm({
        name: currentRestaurant.name || '',
        address: currentRestaurant.address || '',
        phone: currentRestaurant.phone || '',
        ntn: currentRestaurant.ntn || '',
        strn: currentRestaurant.strn || ''
      });
      setLogoPreview(currentRestaurant.logo || '');
    }
  }, [currentRestaurant]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.put('/restaurant', form);
      if (typeof updateProfile === 'function') {
        updateProfile(updated);
      }
      toast.success('Settings updated! Restaurant name will reflect everywhere.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('logo', file);
      const updated = await api.put('/restaurant', formData);
      setLogoPreview(updated.logo || '');
      if (typeof updateProfile === 'function') {
        updateProfile(updated);
      }
      toast.success('Logo uploaded!');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Restaurant Settings</h1>
        <p className="text-gray-500 text-sm">Manage your restaurant profile. Changes reflect across all invoices, receipts, and reports.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Restaurant Logo</h3>
          <div className="flex flex-col items-center gap-4">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-32 h-32 rounded-2xl object-cover border-2 border-gray-200" />
            ) : (
              <div className="w-32 h-32 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">
                <Upload size={32} />
              </div>
            )}
            <label className="cursor-pointer bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2">
              <Upload size={16} /> Upload Logo
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
            <p className="text-xs text-gray-400">Max 5MB. JPG, PNG, GIF, WebP</p>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Restaurant Profile</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant / Hotel Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-lg"
                placeholder="e.g., Zam Zam Hotel"
                required
              />
              <p className="text-xs text-gray-400 mt-1">This name will appear on all invoices, receipts, and reports</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                value={form.address}
                onChange={e => setForm({...form, address: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                rows={2}
                placeholder="Restaurant address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                placeholder="Phone number"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NTN (Optional)</label>
                <input
                  type="text"
                  value={form.ntn}
                  onChange={e => setForm({...form, ntn: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="NTN number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">STRN (Optional)</label>
                <input
                  type="text"
                  value={form.strn}
                  onChange={e => setForm({...form, strn: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="STRN number"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-medium transition disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
