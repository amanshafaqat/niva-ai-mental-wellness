import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, Server, Database, Shield } from 'lucide-react';
import { fetchHealthStatus } from '../lib/api';
import { HealthStatus } from '../types';

export const SystemHealthWidget: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHealthStatus();
      setHealth(data);
    } catch (err: any) {
      setError(err?.message || 'Could not reach /health endpoint');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // 30s poll
    return () => clearInterval(interval);
  }, []);

  return (
    <div id="health-check-panel" className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-800" />
            <span>NIVA System Health & Baseline Telemetry</span>
          </h3>
          <p className="mt-1 text-xs text-stone-600">
            Real-time status returned directly from the NestJS backend endpoint <code className="font-mono bg-stone-100 px-1 py-0.5 rounded text-stone-800">GET /health</code>.
          </p>
        </div>

        <button
          onClick={checkHealth}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Ping /health</span>
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-700 shrink-0" />
          <span>{error}</span>
        </div>
      ) : health ? (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Status */}
            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5">
              <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                Service Status
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-700 animate-pulse" />
                <span className="text-sm font-semibold text-stone-900 capitalize">
                  {health.status} (Phase 1)
                </span>
              </div>
              <div className="text-[10px] text-stone-500 mt-1">{health.service}</div>
            </div>

            {/* Database */}
            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5">
              <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                Database ORM
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-stone-900">
                <Database className="h-4 w-4 text-emerald-800" />
                <span>Prisma Client</span>
              </div>
              <div className="text-[10px] text-stone-500 mt-1">{health.database.provider}</div>
            </div>

            {/* Uptime */}
            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5">
              <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                Server Uptime
              </div>
              <div className="mt-1 text-sm font-semibold text-stone-900 font-mono">
                {health.uptimeSeconds}s
              </div>
              <div className="text-[10px] text-stone-500 mt-1">Environment: {health.environment}</div>
            </div>

            {/* Security */}
            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5">
              <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                Security & RBAC
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
                <Shield className="h-4 w-4" />
                <span>Enforced</span>
              </div>
              <div className="text-[10px] text-stone-500 mt-1">Google OAuth + RolesGuard</div>
            </div>
          </div>

          {/* Raw JSON Payload Collapsible */}
          <details className="group rounded-xl border border-stone-200 bg-stone-50/40 p-3 text-xs">
            <summary className="cursor-pointer font-medium text-stone-700 hover:text-stone-900 flex items-center justify-between">
              <span>View Raw HTTP Payload Response from GET /health</span>
              <span className="text-[10px] text-stone-700 group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <pre className="mt-2.5 overflow-x-auto rounded-lg bg-stone-900 p-3 text-[11px] font-mono text-stone-300 leading-relaxed">
              {JSON.stringify(health, null, 2)}
            </pre>
          </details>
        </div>
      ) : (
        <div className="mt-6 flex items-center justify-center p-8 text-xs text-stone-700">
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          <span>Polling health status...</span>
        </div>
      )}
    </div>
  );
};
