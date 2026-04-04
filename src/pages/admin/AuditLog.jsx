import { useState, useEffect } from 'react';
import { Shield, Download } from 'lucide-react';
import { api }     from '@utils/axios';
import { fDateTime } from '@utils/formatters';
import { cn }      from '@utils/helpers';

export default function AdminAuditLog() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/logs/audit?limit=50')
      .then(r => setLogs(r.data.data || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-500 text-sm mt-0.5">Every admin action recorded</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Admin Actions</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {loading ? (
            [...Array(8)].map((_,i) => (
              <div key={i} className="p-4"><div className="skeleton h-4 w-2/3 mb-2"/><div className="skeleton h-3 w-1/3"/></div>
            ))
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No audit logs yet</div>
          ) : (
            logs.map(log => (
              <div key={log._id} className="p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">{log.action}</span>
                    {log.targetEmail && (
                      <span className="text-xs text-gray-500">→ {log.targetEmail}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    by {log.adminId?.email || 'Admin'} · {fDateTime(log.createdAt)}
                  </p>
                  {log.reason && (
                    <p className="text-xs text-gray-500 mt-0.5">Reason: {log.reason}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}