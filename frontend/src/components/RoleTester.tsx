import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, KeyRound, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { Role, ROLE_PERMISSIONS } from '@shared/constants/roles';
import { testGuardianAccess, testAdminAccess, fetchCurrentUser } from '../lib/api';

export const RoleTester: React.FC = () => {
  const { session, setSimulatedRole } = useAuth();
  const [testResult, setTestResult] = useState<{
    endpoint: string;
    status: number | string;
    success: boolean;
    data: any;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  if (!session) return null;

  const currentRole = session.user.role;
  const permissions = ROLE_PERMISSIONS[currentRole]?.permissions || [];

  const handleTestEndpoint = async (endpointType: 'user' | 'guardian' | 'admin') => {
    setTesting(true);
    try {
      if (endpointType === 'user') {
        const data = await fetchCurrentUser(session.token);
        setTestResult({
          endpoint: 'GET /api/users/me (Standard User Profile)',
          status: 200,
          success: true,
          data,
        });
      } else if (endpointType === 'guardian') {
        const res = await testGuardianAccess(session.token);
        setTestResult({
          endpoint: 'GET /api/users/guardian/summary (Guardian Oversight)',
          status: res.status,
          success: res.ok,
          data: res.data,
        });
      } else if (endpointType === 'admin') {
        const res = await testAdminAccess(session.token);
        setTestResult({
          endpoint: 'GET /api/users/admin/directory (Admin Directory)',
          status: res.status,
          success: res.ok,
          data: res.data,
        });
      }
    } catch (err: any) {
      setTestResult({
        endpoint: `Test ${endpointType}`,
        status: 500,
        success: false,
        data: { error: err.message },
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div id="role-tester-panel" className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-emerald-800" />
            <span>Server-Side RBAC Enforcement Tester</span>
          </h3>
          <p className="mt-1 text-xs text-stone-600">
            Verify how the NestJS backend <code className="font-mono bg-stone-100 px-1 py-0.5 rounded text-stone-800">RolesGuard</code>{' '}
            evaluates authorization rules for your active session.
          </p>
        </div>

        {/* Role Toggle for Interactive Evaluation */}
        <div className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 p-1">
          <span className="px-2 text-[11px] font-semibold text-stone-700">Active Role:</span>
          {(['USER', 'GUARDIAN', 'ADMIN'] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setSimulatedRole(r)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                currentRole === r
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Permissions Breakdown */}
      <div className="mt-4 rounded-xl border border-stone-200/80 bg-stone-50/60 p-3.5">
        <div className="text-xs font-semibold text-stone-800 mb-1.5">
          Granted Permissions for {ROLE_PERMISSIONS[currentRole].displayName}:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {permissions.map((perm) => (
            <span
              key={perm}
              className="inline-flex items-center gap-1 rounded-md bg-white border border-stone-200 px-2 py-0.5 text-[11px] font-mono text-stone-700"
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-800" />
              <span>{perm}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Test Buttons */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Test 1: User Endpoint */}
        <button
          onClick={() => handleTestEndpoint('user')}
          disabled={testing}
          className="flex flex-col items-start rounded-xl border border-stone-200 bg-white p-3.5 text-left hover:border-emerald-500 hover:bg-emerald-50/30 transition disabled:opacity-50"
        >
          <span className="text-xs font-semibold text-stone-900">1. Test /users/me</span>
          <span className="text-[11px] text-stone-600 mt-0.5">Permitted for all authenticated roles</span>
          <span className="mt-2 text-[10px] font-semibold uppercase text-emerald-800 bg-emerald-100 rounded px-1.5 py-0.5">
            Expects 200 OK
          </span>
        </button>

        {/* Test 2: Guardian Endpoint */}
        <button
          onClick={() => handleTestEndpoint('guardian')}
          disabled={testing}
          className="flex flex-col items-start rounded-xl border border-stone-200 bg-white p-3.5 text-left hover:border-blue-500 hover:bg-blue-50/30 transition disabled:opacity-50"
        >
          <span className="text-xs font-semibold text-stone-900">2. Test /users/guardian/*</span>
          <span className="text-[11px] text-stone-600 mt-0.5">Requires GUARDIAN or ADMIN role</span>
          <span
            className={`mt-2 text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 ${
              currentRole === Role.GUARDIAN || currentRole === Role.ADMIN
                ? 'text-emerald-800 bg-emerald-100'
                : 'text-amber-800 bg-amber-100'
            }`}
          >
            {currentRole === Role.GUARDIAN || currentRole === Role.ADMIN
              ? 'Expects 200 OK'
              : 'Expects 403 Forbidden'}
          </span>
        </button>

        {/* Test 3: Admin Endpoint */}
        <button
          onClick={() => handleTestEndpoint('admin')}
          disabled={testing}
          className="flex flex-col items-start rounded-xl border border-stone-200 bg-white p-3.5 text-left hover:border-purple-500 hover:bg-purple-50/30 transition disabled:opacity-50"
        >
          <span className="text-xs font-semibold text-stone-900">3. Test /users/admin/*</span>
          <span className="text-[11px] text-stone-600 mt-0.5">Strictly requires ADMIN role</span>
          <span
            className={`mt-2 text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 ${
              currentRole === Role.ADMIN
                ? 'text-emerald-800 bg-emerald-100'
                : 'text-red-800 bg-red-100'
            }`}
          >
            {currentRole === Role.ADMIN ? 'Expects 200 OK' : 'Expects 403 Forbidden'}
          </span>
        </button>
      </div>

      {/* Real Live Response Inspection */}
      {testResult && (
        <div className="mt-5 rounded-xl border border-stone-200 bg-stone-900 p-4 text-white">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2 mb-3">
            <span className="text-xs font-mono text-stone-300">{testResult.endpoint}</span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-bold font-mono ${
                testResult.success
                  ? 'bg-emerald-900 text-emerald-200'
                  : 'bg-red-900 text-red-200'
              }`}
            >
              HTTP {testResult.status} {testResult.success ? 'ALLOWED' : 'FORBIDDEN'}
            </span>
          </div>
          <pre className="max-h-48 overflow-auto text-xs font-mono text-stone-300 leading-relaxed">
            {JSON.stringify(testResult.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
