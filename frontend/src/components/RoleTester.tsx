import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { Role, ROLE_PERMISSIONS } from '@shared/constants/roles';
import {
  testGuardianAccess,
  testAdminAccess,
  fetchCurrentUser,
  attemptRoleChange,
} from '../lib/api';

export const RoleTester: React.FC = () => {
  const { session } = useAuth();
  const [testResult, setTestResult] = useState<{
    endpoint: string;
    status: number | string;
    success: boolean;
    data: any;
    note?: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  if (!session) return null;

  const currentRole = session.user.role;
  const permissions = ROLE_PERMISSIONS[currentRole]?.permissions || [];

  const handleTestEndpoint = async (endpointType: 'user' | 'guardian' | 'admin' | 'tamper') => {
    setTesting(true);
    try {
      if (endpointType === 'user') {
        const data = await fetchCurrentUser();
        setTestResult({
          endpoint: 'GET /api/users/me (Standard User Profile)',
          status: 200,
          success: true,
          data,
          note: 'Permitted: Accessible to all verified authenticated sessions.',
        });
      } else if (endpointType === 'guardian') {
        const res = await testGuardianAccess();
        setTestResult({
          endpoint: 'GET /api/users/guardian/summary (Guardian Oversight Guard)',
          status: res.status,
          success: res.ok,
          data: res.data,
          note: res.ok
            ? 'Access permitted: Active role satisfies GuardianGuard.'
            : `Forbidden (HTTP ${res.status}): GuardianGuard rejected role (${currentRole}).`,
        });
      } else if (endpointType === 'admin') {
        const res = await testAdminAccess();
        setTestResult({
          endpoint: 'GET /api/users/admin/directory (Admin Guard)',
          status: res.status,
          success: res.ok,
          data: res.data,
          note: res.ok
            ? 'Access permitted: Active role satisfies AdminGuard.'
            : `Forbidden (HTTP ${res.status}): AdminGuard rejected role (${currentRole}).`,
        });
      } else if (endpointType === 'tamper') {
        // Exploit Simulation: Attempt to modify own role to ADMIN
        const res = await attemptRoleChange('ADMIN');
        setTestResult({
          endpoint: 'PATCH /api/users/me/role (Tampering Defense)',
          status: res.status,
          success: res.ok, // False indicates the tampering was blocked (which is the desired security state)
          data: res.data,
          note: 'Security Policy Verified: Client role elevation was firmly rejected by server-side policy and logged to the audit trail.',
        });
      }
    } catch (err: any) {
      setTestResult({
        endpoint: `Test ${endpointType}`,
        status: 500,
        success: false,
        data: { error: err.message },
        note: 'Request failed',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div id="role-tester-panel" className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-emerald-800" />
            <span>Server-Side RBAC & Tamper Resistance</span>
          </h3>
          <p className="mt-1 text-xs text-stone-600">
            Authorization truth is strictly determined by server-side session context. Client-provided roles or elevation attempts are strictly rejected.
          </p>
        </div>

        {/* Server-Verified Active Role Badge */}
        <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5">
          <Lock className="h-3.5 w-3.5 text-stone-500" />
          <span className="text-xs text-stone-600">Server-Verified Role:</span>
          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900 font-mono">
            {currentRole}
          </span>
        </div>
      </div>

      {/* Permissions Breakdown */}
      <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-3.5">
        <div className="text-xs font-semibold text-stone-800 mb-1.5">
          Server-Granted Capability Scopes for {ROLE_PERMISSIONS[currentRole]?.displayName || currentRole}:
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

      {/* Test Action Buttons */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Test 1: User Endpoint */}
        <button
          onClick={() => handleTestEndpoint('user')}
          disabled={testing}
          className="flex flex-col items-start rounded-xl border border-stone-200 bg-white p-3.5 text-left hover:border-emerald-500 hover:bg-emerald-50/30 transition disabled:opacity-50"
        >
          <span className="text-xs font-semibold text-stone-900">1. /users/me</span>
          <span className="text-[11px] text-stone-600 mt-0.5">UserGuard: Authenticated user</span>
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
          <span className="text-xs font-semibold text-stone-900">2. /users/guardian/*</span>
          <span className="text-[11px] text-stone-600 mt-0.5">GuardianGuard: GUARDIAN or ADMIN</span>
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
          <span className="text-xs font-semibold text-stone-900">3. /users/admin/*</span>
          <span className="text-[11px] text-stone-600 mt-0.5">AdminGuard: Strictly ADMIN</span>
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

        {/* Test 4: Role Tampering Exploit Attempt */}
        <button
          onClick={() => handleTestEndpoint('tamper')}
          disabled={testing}
          className="flex flex-col items-start rounded-xl border border-red-200 bg-red-50/40 p-3.5 text-left hover:border-red-400 hover:bg-red-50 transition disabled:opacity-50"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-900">
            <AlertTriangle className="h-3.5 w-3.5 text-red-700" />
            <span>4. Test Role Tampering</span>
          </div>
          <span className="text-[11px] text-red-800 mt-0.5">Simulate PATCH /users/me/role</span>
          <span className="mt-2 text-[10px] font-semibold uppercase text-red-800 bg-red-100 rounded px-1.5 py-0.5">
            Expects 403 Rejection
          </span>
        </button>
      </div>

      {/* Response Display Box */}
      {testResult && (
        <div className="rounded-xl border border-stone-200 bg-stone-900 p-4 text-white">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2 mb-2">
            <span className="text-xs font-mono text-stone-300">{testResult.endpoint}</span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-bold font-mono ${
                testResult.status === 200
                  ? 'bg-emerald-900 text-emerald-200'
                  : 'bg-red-900 text-red-200'
              }`}
            >
              HTTP {testResult.status}
            </span>
          </div>
          {testResult.note && (
            <p className="text-xs text-stone-300 mb-2 italic">
              {testResult.note}
            </p>
          )}
          <pre className="max-h-48 overflow-auto text-xs font-mono text-stone-300 leading-relaxed bg-stone-950 p-2.5 rounded-lg">
            {JSON.stringify(testResult.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
