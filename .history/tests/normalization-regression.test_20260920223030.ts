import { Role } from '../shared/constants/roles';
import { getSessionFromRequest, memoryUsers, sessions } from '../server';
import { updateAdminUserRole, updateAdminUserStatus } from '../src/services/admin/admin-service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Regression test failed: ${message}`);
  }
}

async function runNormalizationRegression() {
  console.log('🧪 Running normalization regression check...');

  const users = new Map<string, any>([
    ['admin-1', { id: 'admin-1', email: 'admin@niva.internal', name: 'Admin', role: Role.ADMIN, status: 'ACTIVE', isActive: true }],
    ['user-1', { id: 'user-1', email: 'user@example.com', name: 'User', role: Role.USER, status: 'ACTIVE', isActive: true }],
  ]);

  const suspended = await updateAdminUserStatus('user-1', 'suspended', 'admin-1', users);
  assert(suspended.status === 'SUSPENDED', 'lowercase status should normalize to uppercase');
  assert(suspended.isActive === false, 'lowercase suspended status should disable active state');

  const promoted = await updateAdminUserRole('user-1', 'guardian', 'admin-1', users);
  assert(promoted.role === Role.GUARDIAN, 'lowercase role should normalize to enum value');

  const token = 'regression-token-1';
  sessions.set(token, {
    token,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user: {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      avatarUrl: null,
      role: Role.GUARDIAN,
      status: 'suspended',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      isActive: true,
    },
  });

  memoryUsers.set('user@example.com', {
    id: 'user-1',
    email: 'user@example.com',
    status: 'suspended',
    isActive: false,
  });

  const blocked = getSessionFromRequest({
    cookies: { niva_session: token },
    headers: {},
  } as any);

  assert(blocked === null, 'suspended session must be rejected even when status casing is mixed');
  assert(!sessions.has(token), 'rejected sessions must be purged from memory');

  console.log('✅ Normalization regression check passed.');
}

runNormalizationRegression().catch((error) => {
  console.error('Normalization regression failed:', error);
  process.exit(1);
});
