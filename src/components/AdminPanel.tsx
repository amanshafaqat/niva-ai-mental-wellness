import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldAlert,
  Activity,
  Server,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  UserCheck,
  UserX,
  ShieldCheck,
  Lock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { Role } from '@shared/constants/roles';
import {
  AdminUserListItemDto,
  AdminSystemStatsDto,
  AdminSystemHealthDto,
  AdminUserDetailDto,
} from '@shared/types/admin';
import { AuditLogEntry } from '@shared/types/audit';
import {
  fetchAdminStats,
  fetchAdminHealth,
  fetchAdminUsers,
  fetchAdminUserDetail,
  updateAdminUserStatusApi,
  updateAdminUserRoleApi,
  fetchAdminAuditLogs,
} from '../lib/api';

export const AdminPanel: React.FC = () => {
  const { session } = useAuth();
  const [activeSection, setActiveSection] = useState<'overview' | 'users' | 'audit' | 'system'>('overview');

  // Stats & Health
  const [stats, setStats] = useState<AdminSystemStatsDto | null>(null);
  const [health, setHealth] = useState<AdminSystemHealthDto | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Users Management
  const [users, setUsers] = useState<AdminUserListItemDto[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetailDto | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [totalAuditLogs, setTotalAuditLogs] = useState(0);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Status message
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = session?.user.role === Role.ADMIN;

  const loadOverview = async () => {
    setLoadingOverview(true);
    try {
      const [statsRes, healthRes] = await Promise.all([
        fetchAdminStats().catch(() => null),
        fetchAdminHealth().catch(() => null),
      ]);
      if (statsRes?.stats) setStats(statsRes.stats);
      if (healthRes) setHealth(healthRes);
    } finally {
      setLoadingOverview(false);
    }
  };

  const loadUsers = async (page = 1) => {
    setLoadingUsers(true);
    try {
      const res = await fetchAdminUsers({
        page,
        limit: 10,
        search: searchQuery,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });
      if (res.success) {
        setUsers(res.users);
        setTotalUsers(res.total);
        setUserPage(res.page);
        setTotalPages(res.totalPages);
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to load users' });
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadAudit = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetchAdminAuditLogs({
        search: auditSearch,
        action: auditActionFilter || undefined,
        limit: 50,
      });
      if (res.success) {
        setAuditLogs(res.logs);
        setTotalAuditLogs(res.total);
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to load audit logs' });
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadOverview();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (activeSection === 'users') {
      loadUsers(userPage);
    } else if (activeSection === 'audit') {
      loadAudit();
    } else if (activeSection === 'system') {
      loadOverview();
    }
  }, [activeSection, userPage, searchQuery, roleFilter, statusFilter, auditSearch, auditActionFilter]);

  const handleViewUserDetail = async (userId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetchAdminUserDetail(userId);
      if (res.success) {
        setSelectedUserDetail({ user: res.user, stats: res.stats });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to load user details' });
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    try {
      const res = await updateAdminUserStatusApi(userId, newStatus);
      setActionMessage({ type: 'success', text: res.message || `Status updated to ${newStatus}` });
      loadUsers(userPage);
      if (selectedUserDetail && selectedUserDetail.user.id === userId) {
        setSelectedUserDetail({
          ...selectedUserDetail,
          user: res.user,
        });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to update user status' });
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const res = await updateAdminUserRoleApi(userId, newRole);
      setActionMessage({ type: 'success', text: res.message || `Role updated to ${newRole}` });
      loadUsers(userPage);
      if (selectedUserDetail && selectedUserDetail.user.id === userId) {
        setSelectedUserDetail({
          ...selectedUserDetail,
          user: res.user,
        });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to update user role' });
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center max-w-xl mx-auto my-12">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 mb-4">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-rose-950">Administrative Access Denied</h2>
        <p className="mt-2 text-xs text-rose-800 leading-relaxed">
          This secure administrative panel strictly requires server-side <code className="font-mono font-bold">Role.ADMIN</code> privileges.
          Your active role is <strong className="font-mono">{session?.user.role || 'UNAUTHENTICATED'}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Message Alert */}
      {actionMessage && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl text-xs ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border border-rose-200 text-rose-900'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs font-semibold underline hover:opacity-75"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Admin Header & Nav Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-800" />
            <h2 className="text-lg font-semibold text-stone-900">NIVA Platform Administration</h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-800">
              Phase 7 Active
            </span>
          </div>
          <p className="text-xs text-stone-600 mt-1">
            Governed system telemetry, user lifecycle controls, and tamper-evident audit logging.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSection('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'overview'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            Overview & Telemetry
          </button>
          <button
            onClick={() => setActiveSection('users')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'users'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            User Governance
          </button>
          <button
            onClick={() => setActiveSection('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'audit'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            Audit Trail
          </button>
          <button
            onClick={() => setActiveSection('system')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'system'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            System Diagnostics
          </button>
        </div>
      </div>

      {/* SECTION 1: OVERVIEW & TELEMETRY */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-stone-900">Platform Operational Summary</h3>
            <button
              onClick={loadOverview}
              disabled={loadingOverview}
              className="flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingOverview ? 'animate-spin' : ''}`} />
              <span>Refresh Telemetry</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
              <div className="text-xs text-stone-500 font-medium">Total Registered Users</div>
              <div className="mt-2 text-2xl font-bold text-stone-900">{stats?.totalUsers ?? '—'}</div>
              <div className="mt-1 text-[11px] text-stone-500 flex gap-2">
                <span className="text-emerald-700">{stats?.activeUsers ?? 0} Active</span>
                <span>•</span>
                <span className="text-rose-700">{stats?.suspendedUsers ?? 0} Suspended</span>
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
              <div className="text-xs text-stone-500 font-medium">Roles Breakdown</div>
              <div className="mt-2 text-xs text-stone-700 space-y-1">
                <div className="flex justify-between">
                  <span>Users:</span>
                  <span className="font-semibold">{stats?.usersByRole.USER ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Guardians:</span>
                  <span className="font-semibold">{stats?.usersByRole.GUARDIAN ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Admins:</span>
                  <span className="font-semibold">{stats?.usersByRole.ADMIN ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
              <div className="text-xs text-stone-500 font-medium">Sessions & Wellness</div>
              <div className="mt-2 text-xs text-stone-700 space-y-1">
                <div className="flex justify-between">
                  <span>Chat Threads:</span>
                  <span className="font-semibold">{stats?.totalConversations ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Voice Sessions:</span>
                  <span className="font-semibold">{stats?.totalVoiceSessions ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Guardian Links:</span>
                  <span className="font-semibold">{stats?.activeGuardianRelationships ?? 0} Active</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
              <div className="text-xs text-stone-500 font-medium">Security & Audit</div>
              <div className="mt-2 text-2xl font-bold text-stone-900">{stats?.totalAuditLogs ?? '—'}</div>
              <div className="mt-1 text-[11px] text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>Zero-leakage telemetry active</span>
              </div>
            </div>
          </div>

          {/* Strict Privacy Notice */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-950 flex gap-3 items-start">
            <Info className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-emerald-900">Privacy Architecture Safeguards</div>
              <p className="mt-0.5 leading-relaxed text-emerald-800">
                In strict adherence to NIVA's mental wellness ethics, platform administrators have <strong>NO access</strong> to user conversation messages, voice recordings, raw audio buffers, journal entries, or internal crisis classifier scores. Only aggregated operational metadata and consented oversight summaries are maintained.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: USER GOVERNANCE */}
      {activeSection === 'users' && (
        <div className="space-y-4">
          {/* Filter / Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search user by name or email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setUserPage(1);
                  }}
                  className="w-full rounded-lg border border-stone-300 pl-9 pr-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setUserPage(1);
                }}
                className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs text-stone-800 focus:border-stone-900 focus:outline-none"
              >
                <option value="">All Roles</option>
                <option value="USER">USER</option>
                <option value="GUARDIAN">GUARDIAN</option>
                <option value="ADMIN">ADMIN</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setUserPage(1);
                }}
                className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs text-stone-800 focus:border-stone-900 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="DEACTIVATED">DEACTIVATED</option>
              </select>

              <button
                onClick={() => loadUsers(userPage)}
                className="p-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-700"
                title="Refresh user list"
              >
                <RefreshCw className={`h-4 w-4 ${loadingUsers ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* User Table */}
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 uppercase font-semibold">
                  <tr>
                    <th className="p-3">User</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Account Status</th>
                    <th className="p-3">Registered At</th>
                    <th className="p-3">Last Sign-In</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-stone-500">
                        {loadingUsers ? 'Loading user directory...' : 'No users match the search criteria.'}
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isSelf = session?.user.id === u.id;
                      return (
                        <tr key={u.id} className="hover:bg-stone-50/50">
                          <td className="p-3">
                            <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                              <span>{u.name || 'Unnamed User'}</span>
                              {isSelf && (
                                <span className="rounded bg-stone-200 px-1 py-0.2 text-[9px] font-mono text-stone-700">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-stone-500 font-mono text-[11px]">{u.email}</div>
                          </td>
                          <td className="p-3">
                            <select
                              value={u.role}
                              disabled={isSelf}
                              onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                              className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs font-medium text-stone-800 disabled:opacity-50 disabled:bg-stone-50"
                            >
                              <option value="USER">USER</option>
                              <option value="GUARDIAN">GUARDIAN</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <select
                              value={u.status}
                              disabled={isSelf}
                              onChange={(e) => handleUpdateStatus(u.id, e.target.value)}
                              className={`rounded border px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
                                u.status === 'ACTIVE'
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                  : u.status === 'SUSPENDED'
                                  ? 'border-rose-300 bg-rose-50 text-rose-900'
                                  : 'border-stone-300 bg-stone-50 text-stone-700'
                              }`}
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="SUSPENDED">SUSPENDED</option>
                              <option value="DEACTIVATED">DEACTIVATED</option>
                            </select>
                          </td>
                          <td className="p-3 text-stone-500">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-stone-500">
                            {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleViewUserDetail(u.id)}
                              className="inline-flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between p-3 border-t border-stone-200 text-xs text-stone-600 bg-stone-50">
              <div>
                Showing page <span className="font-semibold">{userPage}</span> of{' '}
                <span className="font-semibold">{totalPages}</span> ({totalUsers} total users)
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={userPage <= 1 || loadingUsers}
                  onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={userPage >= totalPages || loadingUsers}
                  onClick={() => setUserPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* User Detail Inspect Modal / Drawer */}
          {selectedUserDetail && (
            <div className="rounded-xl border border-stone-300 bg-stone-50 p-5 shadow-xs space-y-3">
              <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                <h4 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-800" />
                  <span>User Record Inspect: {selectedUserDetail.user.email}</span>
                </h4>
                <button
                  onClick={() => setSelectedUserDetail(null)}
                  className="text-xs text-stone-500 hover:text-stone-900 font-semibold"
                >
                  Close Inspect
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-stone-200">
                  <div className="text-stone-500">Conversations Logged</div>
                  <div className="text-lg font-bold text-stone-900 mt-1">
                    {selectedUserDetail.stats.conversationCount}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-stone-200">
                  <div className="text-stone-500">Voice Sessions</div>
                  <div className="text-lg font-bold text-stone-900 mt-1">
                    {selectedUserDetail.stats.voiceSessionCount}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-stone-200">
                  <div className="text-stone-500">Guardian Connections</div>
                  <div className="text-lg font-bold text-stone-900 mt-1">
                    {selectedUserDetail.stats.guardianRelationshipCount +
                      selectedUserDetail.stats.wardRelationshipCount}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-stone-200">
                  <div className="text-stone-500">Voluntary Mood Check-ins</div>
                  <div className="text-lg font-bold text-stone-900 mt-1">
                    {selectedUserDetail.stats.voluntaryCheckInCount}
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-[11px] text-emerald-900">
                <strong>Strict Zero-Knowledge Protection:</strong> Raw dialogue text, voice audio packets, and crisis classification logs are cryptographically withheld from this inspect view.
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: AUDIT TRAIL */}
      {activeSection === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative w-full max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search action or entity..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full rounded-lg border border-stone-300 pl-9 pr-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadAudit}
                className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
                <span>Refresh Logs</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 uppercase font-semibold">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">User ID</th>
                    <th className="p-3">Entity</th>
                    <th className="p-3">Metadata (Sanitized)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono text-[11px]">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-stone-500 font-sans">
                        {loadingAudit ? 'Querying audit ledger...' : 'No audit records found.'}
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-stone-50/60">
                        <td className="p-3 text-stone-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3 font-semibold text-stone-900 whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="p-3 text-stone-600 whitespace-nowrap">
                          {log.userId ? log.userId.substring(0, 16) + '...' : 'System'}
                        </td>
                        <td className="p-3 text-stone-600 whitespace-nowrap">
                          {log.entityType || '—'}
                        </td>
                        <td className="p-3 text-stone-700 max-w-xs truncate font-sans">
                          {log.metadata ? JSON.stringify(log.metadata) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: SYSTEM DIAGNOSTICS */}
      {activeSection === 'system' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
              <Server className="h-4 w-4 text-emerald-800" />
              <span>Platform Health & Architectural State</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-1.5">
                <div className="font-semibold text-stone-900">Database Layer (Prisma ORM)</div>
                <div className="flex items-center gap-2">
                  <span className="text-stone-600">Connection Status:</span>
                  <span
                    className={`font-semibold ${
                      health?.database.connected ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {health?.database.connected ? 'CONNECTED (PostgreSQL)' : 'IN-MEMORY STORE'}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-1.5">
                <div className="font-semibold text-stone-900">RBAC Enforcement</div>
                <div className="flex items-center gap-2">
                  <span className="text-stone-600">Server-Side Authorization:</span>
                  <span className="font-semibold text-emerald-700">ENFORCED (Role.ADMIN)</span>
                </div>
              </div>

              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-1.5">
                <div className="font-semibold text-stone-900">AI Wellness Engine</div>
                <div className="flex items-center gap-2">
                  <span className="text-stone-600">Model Pipeline:</span>
                  <span className="font-semibold text-stone-800">
                    {health?.features.geminiLiveVoice ? 'Gemini 3.8 Live & Multimodal Ready' : 'Standby'}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-1.5">
                <div className="font-semibold text-stone-900">Safety & Guardian Network</div>
                <div className="flex items-center gap-2">
                  <span className="text-stone-600">Emergency Crisis Registry:</span>
                  <span className="font-semibold text-emerald-700">ACTIVE (988 / Multi-tier)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
