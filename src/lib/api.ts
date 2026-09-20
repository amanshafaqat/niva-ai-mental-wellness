import { HealthStatus } from '../types';
import { AuthSession, GoogleOAuthPayload } from '@shared/types/auth';
import { AuditLogEntry } from '@shared/types/audit';

const API_BASE = '/api';

export async function fetchHealthStatus(): Promise<HealthStatus> {
  const res = await fetch('/health', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const altRes = await fetch(`${API_BASE}/health`, {
      headers: { Accept: 'application/json' },
    });
    if (!altRes.ok) {
      throw new Error(`Health check failed with status: ${res.status}`);
    }
    return altRes.json();
  }
  return res.json();
}

/**
 * GET /api/auth/google/url
 * Checks server configuration and returns Google OAuth authorization URL
 */
export async function getGoogleAuthUrl(): Promise<{
  configured: boolean;
  url: string | null;
  clientId: string | null;
  message?: string;
}> {
  const res = await fetch(`${API_BASE}/auth/google/url`, {
    headers: { Accept: 'application/json' },
  });
  return res.json();
}

/**
 * GET /api/auth/me
 * Retrieves currently authenticated user profile using HttpOnly cookie or token
 */
export async function fetchAuthMe(): Promise<{
  success: boolean;
  user: AuthSession['user'];
  expiresAt: string;
}> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'No active session');
  }
  return data;
}

/**
 * POST /api/auth/google/verify
 * Verifies Google ID token or identity payload and establishes HttpOnly session
 */
export async function verifyGoogleAuth(
  payload: GoogleOAuthPayload | { idToken: string } | { credential: string },
): Promise<{ success: boolean; session: AuthSession }> {
  const res = await fetch(`${API_BASE}/auth/google/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Authentication verification failed');
  }
  return data;
}

/**
 * GET /api/users/me
 * Protected user profile endpoint
 */
export async function fetchCurrentUser(token?: string) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/users/me`, {
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch user profile: ${res.status}`);
  }
  return res.json();
}

/**
 * PATCH /api/users/me/role
 * Security check: Demonstrates user role self-modification rejection (HTTP 403)
 */
export async function attemptRoleChange(targetRole: string, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/users/me/role`, {
    method: 'PATCH',
    credentials: 'include',
    headers,
    body: JSON.stringify({ role: targetRole }),
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

/**
 * GET /api/users/guardian/summary
 * Protected route: requires GUARDIAN or ADMIN role
 */
export async function testGuardianAccess(token?: string) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/users/guardian/summary`, {
    credentials: 'include',
    headers,
  });

  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

/**
 * GET /api/users/admin/directory
 * Protected route: strictly requires ADMIN role
 */
export async function testAdminAccess(token?: string) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/users/admin/directory`, {
    credentials: 'include',
    headers,
  });

  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

/**
 * GET /api/audit/logs
 * Protected route: strictly requires ADMIN role
 */
export async function fetchAuditLogs(
  token?: string,
  limit = 20,
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/audit/logs?limit=${limit}`, {
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Audit log fetch failed with status: ${res.status}`);
  }
  return res.json();
}

/**
 * GET /api/admin/stats
 * Administrative dashboard platform statistics
 */
export async function fetchAdminStats() {
  const res = await fetch(`${API_BASE}/admin/stats`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch admin stats: ${res.status}`);
  }
  return res.json();
}

/**
 * GET /api/admin/health
 * Administrative platform health details
 */
export async function fetchAdminHealth() {
  const res = await fetch(`${API_BASE}/admin/health`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch admin health: ${res.status}`);
  }
  return res.json();
}

/**
 * GET /api/admin/users
 * Paginated admin user list
 */
export async function fetchAdminUsers(params: {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.role) query.set('role', params.role);
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/admin/users?${query.toString()}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch users: ${res.status}`);
  }
  return res.json();
}

/**
 * GET /api/admin/users/:userId
 * Privacy-preserving user inspect details
 */
export async function fetchAdminUserDetail(userId: string) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch user details: ${res.status}`);
  }
  return res.json();
}

/**
 * PATCH /api/admin/users/:userId/status
 * Administrative account status update
 */
export async function updateAdminUserStatusApi(userId: string, status: string) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || `Failed to update user status: ${res.status}`);
  }
  return data;
}

/**
 * PATCH /api/admin/users/:userId/role
 * Administrative role assignment
 */
export async function updateAdminUserRoleApi(userId: string, role: string) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ role }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || `Failed to update user role: ${res.status}`);
  }
  return data;
}

/**
 * GET /api/admin/audit
 * Administrative audit query with filter parameters
 */
export async function fetchAdminAuditLogs(params: {
  action?: string;
  userId?: string;
  search?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params.action) query.set('action', params.action);
  if (params.userId) query.set('userId', params.userId);
  if (params.search) query.set('search', params.search);
  if (params.limit) query.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/admin/audit?${query.toString()}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch admin audit logs: ${res.status}`);
  }
  return res.json();
}


/**
 * POST /api/auth/logout
 * Invalidates session on server and clears HttpOnly session cookie
 */
export async function logoutSession(token?: string): Promise<void> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers,
  });
}
