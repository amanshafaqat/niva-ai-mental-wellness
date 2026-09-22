import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw, AlertCircle, Clock, Key, UserCheck, ShieldAlert } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { fetchAuditLogs } from '../lib/api';
import { AuditLogEntry } from '@shared/types/audit';
import { Role } from '@shared/constants/roles';

export const AuditLogViewer: React.FC = () => {
  const { session } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAuditLogs(session.token);
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [session?.token, session?.user.role]);

  const isAdmin = session?.user.role === Role.ADMIN;

  const getActionBadge = (action: string) => {
    if (action.includes('SUCCESS') || action.includes('CREATED')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (action.includes('DENIED') || action.includes('FAILED')) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    if (action.includes('ROLE') || action.includes('ADMIN')) {
      return 'bg-purple-100 text-purple-800 border-purple-200';
    }
    return 'bg-stone-100 text-stone-800 border-stone-200';
  };

  return (
    <div id="audit-log-panel" className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-800" />
            <span>Immutable Security Audit Trail</span>
          </h3>
          <p className="mt-1 text-xs text-stone-600">
            Every authentication event, role check, and access attempt is logged for governance and SIEM compliance.
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Trail</span>
        </button>
      </div>

      {!isAdmin ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4 text-amber-700" />
            <span>RBAC Protected Resource</span>
          </div>
          <p className="mt-1">
            Access to the full platform security audit trail requires the <strong>ADMIN</strong> role.
            Your current role is <strong>{session?.user.role}</strong>. Switch to the ADMIN role in the
            tester above or sign in as Platform Administrator to query the logs.
          </p>
        </div>
      ) : error ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-700" />
          <span>{error}</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-stone-300 p-8 text-center text-xs text-stone-600">
          No audit entries recorded yet in this session.
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-stone-200">
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-stone-100/90 backdrop-blur-xs font-semibold text-stone-700">
                <tr>
                  <th className="p-3">Action</th>
                  <th className="p-3">Entity</th>
                  <th className="p-3">User ID</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-[10px] font-semibold ${getActionBadge(
                          log.action,
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-stone-700 font-sans">{log.entityType || '—'}</td>
                    <td className="p-3 text-stone-600 truncate max-w-[120px]" title={log.userId || 'system'}>
                      {log.userId ? log.userId.substring(0, 12) + '...' : 'System'}
                    </td>
                    <td className="p-3 text-stone-700 font-sans text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
