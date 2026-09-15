import { HealthStatus } from '../types';
import { AuthSession, GoogleOAuthPayload } from '@shared/types/auth';
import { AuditLogEntry } from '@shared/types/audit';

const API_BASE = '/api';

export async function fetchHealthStatus(): Promise<HealthStatus> {
  const res = await fetch('/health', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    // Fallback to /api/health if reverse proxy rewrites prefix
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

export async function verifyGoogleAuth(
  payload: GoogleOAuthPayload,
): Promise<{ success: boolean; session: AuthSession }> {
  const res = await fetch(`${API_BASE}/auth/google/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Authentication failed');
  }
  return data;
}

export async function fetchCurrentUser(token: string) {
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch user profile: ${res.status}`);
  }
  return res.json();
}

export async function testGuardianAccess(token: string) {
  const res = await fetch(`${API_BASE}/users/guardian/summary`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

export async function testAdminAccess(token: string) {
  const res = await fetch(`${API_BASE}/users/admin/directory`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

export async function fetchAuditLogs(
  token: string,
  limit = 20,
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const res = await fetch(`${API_BASE}/audit/logs?limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Audit log fetch failed with status: ${res.status}`);
  }
  return res.json();
}

export async function logoutSession(token: string): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
}
