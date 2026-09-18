import React, { useState } from 'react';
import {
  User,
  Shield,
  Key,
  Lock,
  Clock,
  Sparkles,
  CheckCircle2,
  FileText,
  AlertCircle,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { RoleTester } from './RoleTester';
import { AuditLogViewer } from './AuditLogViewer';
import { WellnessChatSession } from './WellnessChatSession';
import { Role, ROLE_PERMISSIONS } from '@shared/constants/roles';

export const DashboardView: React.FC = () => {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'session' | 'profile' | 'rbac' | 'audit' | 'privacy'>('session');

  if (!session) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-600 mb-4">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-stone-900">Authentication Required</h2>
        <p className="mt-1 text-sm text-stone-600 max-w-sm mx-auto">
          Please sign in with Google to access your protected NIVA wellness dashboard and verify RBAC controls.
        </p>
      </div>
    );
  }

  const { user } = session;
  const roleConfig = ROLE_PERMISSIONS[user.role as Role] || ROLE_PERMISSIONS[Role.USER];

  return (
    <div id="authenticated-dashboard" className="py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* User Identity Header Card */}
        <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || 'Profile Avatar'}
                  className="h-16 w-16 rounded-2xl object-cover border border-stone-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 text-2xl font-bold">
                  {user.name?.[0] || 'U'}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                    {user.name || 'NIVA Companion User'}
                  </h1>
                  <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900">
                    {user.role}
                  </span>
                  <span className="rounded-md border border-stone-200 bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                    Status: {user.status || 'ACTIVE'}
                  </span>
                </div>
                <p className="text-sm text-stone-600">{user.email}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-stone-500 font-mono">
                  <span>ID: {user.id}</span>
                  <span>•</span>
                  <span>Auth: HttpOnly Cookie</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-1.5 text-xs text-stone-700 bg-stone-50 p-3 rounded-xl border border-stone-200">
              <span className="font-semibold text-stone-800">Session Security Status</span>
              <span className="flex items-center gap-1 text-emerald-800 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Google OAuth Authenticated
              </span>
              <span className="text-[11px] text-stone-700">
                Expires: {new Date(session.expiresAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Phase 4 Active Status Notice */}
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950 flex items-start gap-3">
          <Sparkles className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Phase 4 Active:</span> Realtime Voice-to-Voice AI Agent powered by Gemini Live (gemini-3.8-live), bidirectional WebSocket audio relay, barge-in interruption, and non-clinical empathetic conversational guardrails are fully operational.
          </div>
        </div>

        {/* Role-Specific Area Foundations */}
        {user.role === Role.ADMIN && (
          <div className="mt-6 rounded-2xl border border-purple-200 bg-purple-50/40 p-5 shadow-xs">
            <div className="flex items-center gap-2 text-purple-950 font-semibold mb-1">
              <Shield className="h-4 w-4 text-purple-700" />
              <span>Admin Area Foundation</span>
            </div>
            <p className="text-xs text-purple-900 leading-relaxed">
              Administrative platform monitoring and user directory access. This foundation establishes the authorization boundaries (<code className="font-mono bg-purple-100 px-1 py-0.5 rounded">AdminGuard</code>) for full administrative dashboards in future phases.
            </p>
          </div>
        )}

        {user.role === Role.GUARDIAN && (
          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/40 p-5 shadow-xs">
            <div className="flex items-center gap-2 text-blue-950 font-semibold mb-1">
              <Shield className="h-4 w-4 text-blue-700" />
              <span>Guardian Area Foundation</span>
            </div>
            <p className="text-xs text-blue-900 leading-relaxed">
              Guardian oversight area for consented wards. Direct dialogue access is strictly prohibited by architecture; only high-level safety signals and risk notifications are authorized.
            </p>
          </div>
        )}

        {/* Dashboard Navigation Tabs */}
        <div className="mt-8 flex flex-wrap border-b border-stone-200 gap-2">
          <button
            onClick={() => setActiveTab('session')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              activeTab === 'session'
                ? 'border-emerald-700 text-emerald-800 font-semibold'
                : 'border-transparent text-stone-700 hover:text-stone-900'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>NIVA Wellness Session</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              activeTab === 'profile'
                ? 'border-emerald-700 text-emerald-800 font-semibold'
                : 'border-transparent text-stone-700 hover:text-stone-900'
            }`}
          >
            <User className="h-4 w-4" />
            <span>Profile & Permissions</span>
          </button>
          <button
            onClick={() => setActiveTab('rbac')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              activeTab === 'rbac'
                ? 'border-emerald-700 text-emerald-800 font-semibold'
                : 'border-transparent text-stone-700 hover:text-stone-900'
            }`}
          >
            <Key className="h-4 w-4" />
            <span>RBAC Server Enforcement</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              activeTab === 'audit'
                ? 'border-emerald-700 text-emerald-800 font-semibold'
                : 'border-transparent text-stone-700 hover:text-stone-900'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>Security Audit Log</span>
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              activeTab === 'privacy'
                ? 'border-emerald-700 text-emerald-800 font-semibold'
                : 'border-transparent text-stone-700 hover:text-stone-900'
            }`}
          >
            <EyeOff className="h-4 w-4" />
            <span>Privacy & Consent Controls</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="mt-6">
          {activeTab === 'session' && <WellnessChatSession />}

          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
                <h3 className="text-base font-semibold text-stone-900 mb-1">
                  Active Role: {roleConfig.displayName}
                </h3>
                <p className="text-xs text-stone-600 mb-4">{roleConfig.description}</p>

                <div className="text-xs font-semibold text-stone-800 uppercase tracking-wider mb-2">
                  Server-Granted Capability Scopes:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {roleConfig.permissions.map((perm) => (
                    <div
                      key={perm}
                      className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50/70 p-2.5 text-xs text-stone-700"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-800 shrink-0" />
                      <span className="font-mono">{perm}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rbac' && <RoleTester />}

          {activeTab === 'audit' && <AuditLogViewer />}

          {activeTab === 'privacy' && (
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                  <EyeOff className="h-5 w-5 text-emerald-800" />
                  <span>Privacy & Zero-Knowledge Architecture</span>
                </h3>
                <p className="mt-1 text-xs text-stone-600">
                  NIVA is engineered to safeguard intimate emotional and mental health disclosures.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-stone-700 pt-2">
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <div className="font-semibold text-stone-900 text-sm mb-1">
                    No Commercial Telemetry
                  </div>
                  <p className="leading-relaxed">
                    Personal conversations are never exposed to ad networks, data brokers, or
                    external analytics SDKs.
                  </p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <div className="font-semibold text-stone-900 text-sm mb-1">
                    Consent-Gated Guardian Link
                  </div>
                  <p className="leading-relaxed">
                    Guardians cannot access user records without explicit, active consent. Even when
                    consented, guardian views are high-level safety summaries, never raw transcripts.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
