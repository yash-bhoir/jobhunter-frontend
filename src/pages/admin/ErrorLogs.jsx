import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, AlertCircle, Info, CheckCircle,
  RefreshCw, Trash2, ChevronDown, ChevronUp,
  Search, Filter, X, Monitor, Server, Clock, User
} from 'lucide-react';
import { api }       from '@utils/axios';
import { fDateTime } from '@utils/formatters';
import { cn }        from '@utils/helpers';

const SEVERITY_STYLE = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-amber-100 text-amber-700 border-amber-200',
  low:      'bg-gray-100 text-gray-600 border-gray-200',
};

const SEVERITY_ICON = {
  critical: <AlertCircle className="w-3.5 h-3.5" />,
  high:     <AlertTriangle className="w-3.5 h-3.5" />,
  medium:   <AlertTriangle className="w-3.5 h-3.5" />,
  low:      <Info className="w-3.5 h-3.5" />,
};

const TYPE_STYLE = {
  frontend: 'bg-violet-100 text-violet-700',
  backend:  'bg-blue-100 text-blue-700',
};

export default function ErrorLogs() {
  const [logs,     setLogs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [total,    setTotal]    = useState(0);
  const [stats,    setStats]    = useState({});
  const [page,     setPage]     = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [resolving, setResolving] = useState({});

  const [filters, setFilters] = useState({
    severity: '', type: '', resolved: 'false', search: '',
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page, limit: 50,
        ...(filters.severity && { severity: filters.severity }),
        ...(filters.type     && { type:     filters.type }),
        ...(filters.resolved !== '' && { resolved: filters.resolved }),
        ...(filters.search   && { search:   filters.search }),
      });
      const { data } = await api.get(`/admin/logs/error-logs?${params}`);
      setLogs(data.data || []);
      setTotal(data.pagination?.total || 0);
      setStats(data.pagination?.stats || {});
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const resolve = async (id) => {
    setResolving(p => ({ ...p, [id]: true }));
    try {
      await api.patch(`/admin/logs/error-logs/${id}/resolve`);
      setLogs(prev => prev.map(l => l._id === id ? { ...l, resolved: true } : l));
    } catch { /* silent */ }
    finally { setResolving(p => ({ ...p, [id]: false })); }
  };

  const deleteLog = async (id) => {
    try {
      await api.delete(`/admin/logs/error-logs/${id}`);
      setLogs(prev => prev.filter(l => l._id !== id));
      setTotal(t => t - 1);
    } catch { /* silent */ }
  };

  const bulkResolveAll = async () => {
    try {
      await api.post('/admin/logs/error-logs/bulk-resolve', { severity: filters.severity || undefined });
      fetchLogs();
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Error Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time errors from all users — backend + frontend</p>
        </div>
        <button onClick={fetchLogs} className="btn btn-secondary btn-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Unresolved',  value: stats.unresolved, icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'Critical',    value: stats.critical,   icon: AlertCircle,   color: 'text-red-500',    bg: 'bg-red-50' },
          { label: 'Last 24h',    value: stats.last24h,    icon: Clock,         color: 'text-blue-500',   bg: 'bg-blue-50' },
          { label: 'Total',       value: total,            icon: Server,        color: 'text-gray-500',   bg: 'bg-gray-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{s.value ?? '—'}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search error message…"
            value={filters.search}
            onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
            className="input pl-9 text-sm"
          />
        </div>
        <select value={filters.severity} onChange={e => setFilters(p => ({ ...p, severity: e.target.value }))} className="input text-sm w-36">
          <option value="">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={filters.type} onChange={e => setFilters(p => ({ ...p, type: e.target.value }))} className="input text-sm w-32">
          <option value="">All Types</option>
          <option value="backend">Backend</option>
          <option value="frontend">Frontend</option>
        </select>
        <select value={filters.resolved} onChange={e => setFilters(p => ({ ...p, resolved: e.target.value }))} className="input text-sm w-36">
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
          <option value="">All</option>
        </select>
        {filters.resolved === 'false' && logs.length > 0 && (
          <button onClick={bulkResolveAll} className="btn btn-secondary btn-sm ml-auto">
            <CheckCircle className="w-3.5 h-3.5" /> Resolve All
          </button>
        )}
      </div>

      {/* Log list */}
      <div className="space-y-2">
        {loading ? (
          [...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="skeleton h-4 w-2/3 mb-2 rounded-lg" />
              <div className="skeleton h-3 w-1/3 rounded-lg" />
            </div>
          ))
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="font-bold text-gray-900 mb-1">No errors found</p>
            <p className="text-gray-400 text-sm">All clear with current filters</p>
          </div>
        ) : (
          logs.map(log => (
            <motion.div
              key={log._id}
              layout
              className={cn(
                'bg-white rounded-2xl border-2 overflow-hidden transition-colors',
                log.resolved ? 'border-gray-100 opacity-60' : 'border-gray-100 hover:border-red-200'
              )}
            >
              {/* Row */}
              <div
                className="p-4 cursor-pointer flex items-start gap-3"
                onClick={() => setExpanded(expanded === log._id ? null : log._id)}
              >
                {/* Severity icon */}
                <div className={cn('mt-0.5 flex-shrink-0 p-1.5 rounded-lg border', SEVERITY_STYLE[log.severity])}>
                  {SEVERITY_ICON[log.severity]}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border', SEVERITY_STYLE[log.severity])}>
                      {log.severity?.toUpperCase()}
                    </span>
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1', TYPE_STYLE[log.type])}>
                      {log.type === 'frontend' ? <Monitor className="w-2.5 h-2.5" /> : <Server className="w-2.5 h-2.5" />}
                      {log.type}
                    </span>
                    {log.statusCode && (
                      <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                        {log.statusCode}
                      </span>
                    )}
                    {log.resolved && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        RESOLVED
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-gray-900 truncate">{log.message}</p>

                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {log.endpoint && (
                      <span className="text-xs font-mono text-gray-400 truncate max-w-[200px]">{log.endpoint}</span>
                    )}
                    {(log.userId?.email || log.userEmail) && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {log.userId?.email || log.userEmail}
                      </span>
                    )}
                    <span className="text-xs text-gray-300 ml-auto">{fDateTime(log.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {!log.resolved && (
                    <button
                      onClick={e => { e.stopPropagation(); resolve(log._id); }}
                      disabled={resolving[log._id]}
                      className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors"
                      title="Mark resolved"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); deleteLog(log._id); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expanded === log._id
                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>

              {/* Expanded detail */}
              <AnimatePresence>
                {expanded === log._id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-gray-100"
                  >
                    <div className="p-4 bg-gray-50 space-y-3 text-xs">
                      {log.stack && (
                        <div>
                          <p className="font-semibold text-gray-500 uppercase tracking-wide mb-1">Stack Trace</p>
                          <pre className="bg-gray-900 text-green-400 rounded-xl p-3 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap break-all">
                            {log.stack}
                          </pre>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ['IP',         log.ip],
                          ['Method',     log.method],
                          ['User Agent', log.userAgent],
                          ['Code',       log.code],
                          ['Resolved By', log.resolvedBy],
                          ['Resolved At', log.resolvedAt ? fDateTime(log.resolvedAt) : null],
                        ].filter(([, v]) => v).map(([k, v]) => (
                          <div key={k} className="bg-white rounded-lg p-2 border border-gray-100">
                            <p className="text-gray-400 text-[10px] font-semibold uppercase">{k}</p>
                            <p className="text-gray-700 font-mono text-[11px] truncate">{v}</p>
                          </div>
                        ))}
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div>
                          <p className="font-semibold text-gray-500 uppercase tracking-wide mb-1">Metadata</p>
                          <pre className="bg-white border border-gray-100 rounded-lg p-2 text-[11px] text-gray-600 overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn btn-secondary btn-sm">Prev</button>
          <span className="text-sm text-gray-500">{page} / {Math.ceil(total / 50)}</span>
          <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="btn btn-secondary btn-sm">Next</button>
        </div>
      )}
    </div>
  );
}
