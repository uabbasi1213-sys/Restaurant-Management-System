import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';

export default function AuditLogs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => { if (profile?.id) loadLogs(); }, [page, profile?.id]);

  const loadLogs = async () => {
    try {
      const data = await api.get('/audit-logs?page=' + page + '&limit=50&module=');
      setLogs(data.logs || data || []);
      const total = data.total || 0;
      setTotalPages(Math.ceil(total / 50) || 1);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'ADD': case 'LOGIN': return 'bg-green-100 text-green-700';
      case 'EDIT': return 'bg-blue-100 text-blue-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Audit Logs</h1>
        <p className="text-gray-500 text-sm">Track all system activities — Only Super Admin access</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date & Time</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Module</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">{log.username}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{log.module}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{log.details}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    <FileText size={32} className="mx-auto mb-2 opacity-50" />
                    No audit logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t bg-gray-50">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
