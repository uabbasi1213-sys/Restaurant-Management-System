import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Database, Download, Trash2, RefreshCw, HardDrive, Server, Shield, RotateCcw, Plus } from 'lucide-react';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function Backups() {
  const [backups, setBackups] = useState([]);
  const [systemInfo, setSystemInfo] = useState(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState('backups');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [b, s] = await Promise.all([
        api.get('/backups'),
        api.get('/backups/system-info')
      ]);
      setBackups(b);
      setSystemInfo(s);
    } catch (err) { toast.error(err.message); }
  };

  const createBackup = async () => {
    setCreating(true);
    try {
      await api.post('/backups', { type: 'manual' });
      toast.success('Backup created!');
      loadData();
    } catch (err) { toast.error(err.message); }
    setCreating(false);
  };

  const downloadBackup = (id) => {
    const token = localStorage.getItem('token');
    window.open(`/api/backups/download/${id}?token=${token}`, '_blank');
  };

  const deleteBackup = async (id) => {
    if (!confirm('Delete this backup permanently?')) return;
    try {
      await api.delete(`/backups/${id}`);
      toast.success('Backup deleted');
      loadData();
    } catch (err) { toast.error(err.message); }
  };

  const restoreBackup = async (id, filename) => {
    if (!confirm(`Restore from ${filename}? A safety backup will be created first. The server will need a restart.`)) return;
    try {
      const res = await api.post(`/backups/restore/${id}`);
      toast.success(res.message);
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Database size={28} /> Backup & System</h1>
        </div>
        <button onClick={createBackup} disabled={creating}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition disabled:opacity-50">
          {creating ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />}
          {creating ? 'Creating...' : 'Create Backup'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1 mb-6">
        <button onClick={() => setTab('backups')} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${tab === 'backups' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-600'}`}>
          Backups
        </button>
        <button onClick={() => setTab('system')} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${tab === 'system' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-600'}`}>
          System Info
        </button>
      </div>

      {tab === 'backups' ? (
        <>
          {/* Backup Stats */}
          {systemInfo && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-xs text-gray-500 mb-1">Database Size</p>
                <p className="text-xl font-bold text-gray-800">{formatBytes(systemInfo.database.size)}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-xs text-gray-500 mb-1">Total Backups</p>
                <p className="text-xl font-bold text-blue-600">{systemInfo.backups.count}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-xs text-gray-500 mb-1">Backup Storage</p>
                <p className="text-xl font-bold text-gray-800">{formatBytes(systemInfo.backups.totalSize)}</p>
              </div>
            </div>
          )}

          {/* Backups Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Filename</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Size</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Created By</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {backups.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-mono text-sm text-gray-800">{b.filename}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${b.type === 'auto' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {b.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">{formatBytes(b.size)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{b.created_by_name || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{new Date(b.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => downloadBackup(b.id)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title="Download">
                            <Download size={16} />
                          </button>
                          <button onClick={() => restoreBackup(b.id, b.filename)} className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50" title="Restore">
                            <RotateCcw size={16} />
                          </button>
                          <button onClick={() => deleteBackup(b.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {backups.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      <Database size={32} className="mx-auto mb-2 opacity-50" />
                      No backups yet. Create your first backup.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : systemInfo && (
        <div className="space-y-6">
          {/* Server Info */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><Server size={18} /> Server</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Node.js</p>
                <p className="font-semibold text-gray-800">{systemInfo.server.nodeVersion}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Platform</p>
                <p className="font-semibold text-gray-800 capitalize">{systemInfo.server.platform}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Uptime</p>
                <p className="font-semibold text-gray-800">{formatUptime(systemInfo.server.uptime)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Database Size</p>
                <p className="font-semibold text-gray-800">{formatBytes(systemInfo.database.size)}</p>
              </div>
            </div>
          </div>

          {/* Record Counts */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><HardDrive size={18} /> Database Records</h3>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {Object.entries(systemInfo.records).map(([key, val]) => (
                <div key={key} className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 capitalize">{key}</p>
                  <p className="text-lg font-bold text-gray-800">{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Security Info */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><Shield size={18} /> Security</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm bg-green-50 rounded-lg p-3">
                <span className="text-gray-600">JWT Authentication</span>
                <span className="text-green-600 font-semibold">Active ✓</span>
              </div>
              <div className="flex justify-between text-sm bg-green-50 rounded-lg p-3">
                <span className="text-gray-600">Role-Based Access Control</span>
                <span className="text-green-600 font-semibold">Active ✓</span>
              </div>
              <div className="flex justify-between text-sm bg-green-50 rounded-lg p-3">
                <span className="text-gray-600">Password Hashing (bcrypt)</span>
                <span className="text-green-600 font-semibold">Active ✓</span>
              </div>
              <div className="flex justify-between text-sm bg-green-50 rounded-lg p-3">
                <span className="text-gray-600">Audit Logging</span>
                <span className="text-green-600 font-semibold">Active ✓</span>
              </div>
              <div className="flex justify-between text-sm bg-green-50 rounded-lg p-3">
                <span className="text-gray-600">Multi-Tenant (Restaurant ID)</span>
                <span className="text-green-600 font-semibold">Active ✓</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
