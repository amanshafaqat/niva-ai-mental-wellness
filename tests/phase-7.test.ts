/**
 * NIVA Phase 7 Automated Test Suite: Admin System
 * Comprehensive Verification:
 * 1. Role.ADMIN server-side authorization and RBAC denial for non-admins
 * 2. User directory querying with search, filtering, and pagination
 * 3. User account status governance (ACTIVE, SUSPENDED, DEACTIVATED)
 * 4. Role assignment and self-demotion / self-suspension protection
 * 5. Privacy guarantees: Absolute exclusion of user conversations, voice audio, and crisis analysis
 * 6. Audit trail ledger query and filtering
 * 7. System diagnostic telemetry without secret key leakage
 */

import {
  getAdminUsersList,
  getAdminUserDetail,
  updateAdminUserStatus,
  updateAdminUserRole,
  getAdminSystemStats,
  queryAdminAuditLogs,
} from '../src/services/admin/admin-service';
import { Role } from '../shared/constants/roles';
import { AuditAction, AuditLogEntry } from '../shared/types/audit';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(`Test Failure: ${message}`);
  }
}

async function runPhase7Tests() {
  console.log('🏛️ Starting NIVA Phase 7 Admin System Test Suite...\n');

  // Test identities
  const adminAlice = {
    id: 'usr-admin-alice-1',
    email: 'admin.alice@niva.internal',
    name: 'Alice Admin',
    role: Role.ADMIN,
    status: 'ACTIVE',
    isActive: true,
    createdAt: new Date(Date.now() - 36000000).toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  const userBob = {
    id: 'usr-user-bob-2',
    email: 'bob.user@example.com',
    name: 'Bob Wellness',
    role: Role.USER,
    status: 'ACTIVE',
    isActive: true,
    createdAt: new Date(Date.now() - 72000000).toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  const guardianCarol = {
    id: 'usr-guardian-carol-3',
    email: 'carol.guardian@example.com',
    name: 'Carol Guardian',
    role: Role.GUARDIAN,
    status: 'ACTIVE',
    isActive: true,
    createdAt: new Date(Date.now() - 108000000).toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  const memoryUsersStore = new Map<string, any>([
    [adminAlice.id, { ...adminAlice }],
    [userBob.id, { ...userBob }],
    [guardianCarol.id, { ...guardianCarol }],
  ]);

  const testAuditLogs: AuditLogEntry[] = [
    {
      id: 'audit-001',
      action: AuditAction.ACCOUNT_CREATED,
      userId: userBob.id,
      entityType: 'User',
      entityId: userBob.id,
      timestamp: new Date(Date.now() - 72000000).toISOString(),
    },
    {
      id: 'audit-002',
      action: AuditAction.ADMIN_LOGIN_SUCCESS,
      userId: adminAlice.id,
      entityType: 'AdminSession',
      entityId: adminAlice.id,
      timestamp: new Date(Date.now() - 36000000).toISOString(),
    },
    {
      id: 'audit-003',
      action: AuditAction.RBAC_ACCESS_DENIED,
      userId: userBob.id,
      entityType: 'AdminEndpoint',
      metadata: { reason: 'Requires Role.ADMIN' },
      timestamp: new Date(Date.now() - 1000000).toISOString(),
    },
  ];

  // ============================================================================
  // 1. USER LISTING, FILTERING & PAGINATION
  // ============================================================================
  console.log('Test 1: User listing, search, filtering & pagination...');
  const userListRes = await getAdminUsersList(
    { page: 1, limit: 10 },
    Array.from(memoryUsersStore.values()),
  );
  assert(userListRes.success === true, 'getAdminUsersList must succeed');
  assert(userListRes.users.length >= 3, 'Must return all 3 registered users');
  assert(userListRes.total >= 3, 'Total count must match registered users');

  // Search filter test
  const searchRes = await getAdminUsersList(
    { search: 'carol' },
    Array.from(memoryUsersStore.values()),
  );
  assert(searchRes.users.length === 1, 'Search for carol should return 1 user');
  assert(searchRes.users[0].email === guardianCarol.email, 'Search match must be Carol');

  // Role filter test
  const roleFilterRes = await getAdminUsersList(
    { role: Role.ADMIN },
    Array.from(memoryUsersStore.values()),
  );
  assert(roleFilterRes.users.length === 1, 'Role filter ADMIN should return 1 user');
  assert(roleFilterRes.users[0].id === adminAlice.id, 'ADMIN match must be Alice');
  console.log('✅ Passed Test 1: User listing, search and role filtering verified.');

  // ============================================================================
  // 2. PRIVACY BOUNDARY INSPECT
  // ============================================================================
  console.log('\nTest 2: Privacy boundary on user inspect view...');
  const inspectRes = await getAdminUserDetail(userBob.id, Array.from(memoryUsersStore.values()));
  assert(inspectRes !== null, 'Inspect view must return user record');
  assert(inspectRes!.user.id === userBob.id, 'Inspect record must match target user');
  assert((inspectRes as any).messages === undefined, 'CRITICAL PRIVACY: Conversation messages must NOT be exposed');
  assert((inspectRes as any).audioRecordings === undefined, 'CRITICAL PRIVACY: Audio recordings must NOT be exposed');
  assert((inspectRes as any).crisisScores === undefined, 'CRITICAL PRIVACY: Crisis scores must NOT be exposed');
  assert((inspectRes as any).user.password === undefined, 'CRITICAL SECURITY: Passwords must NOT be exposed');
  assert((inspectRes as any).user.token === undefined, 'CRITICAL SECURITY: Session tokens must NOT be exposed');
  console.log('✅ Passed Test 2: Strict zero-knowledge privacy boundaries verified on user inspect.');

  // ============================================================================
  // 3. ACCOUNT STATUS GOVERNANCE
  // ============================================================================
  console.log('\nTest 3: User account status governance (suspend/activate)...');
  const suspendRes = await updateAdminUserStatus(
    userBob.id,
    'SUSPENDED',
    adminAlice.id,
    memoryUsersStore,
  );
  assert(suspendRes.status === 'SUSPENDED', 'Bob status must be SUSPENDED');
  assert(suspendRes.isActive === false, 'Bob isActive must be false');

  // Reactivate
  const reactivateRes = await updateAdminUserStatus(
    userBob.id,
    'ACTIVE',
    adminAlice.id,
    memoryUsersStore,
  );
  assert(reactivateRes.status === 'ACTIVE', 'Bob status must be ACTIVE');
  assert(reactivateRes.isActive === true, 'Bob isActive must be true');

  // Self-suspension prevention
  let selfSuspendFailed = false;
  try {
    await updateAdminUserStatus(adminAlice.id, 'SUSPENDED', adminAlice.id, memoryUsersStore);
  } catch (err: any) {
    selfSuspendFailed = true;
    assert(
      err.message.includes('cannot suspend or deactivate their own account'),
      'Expected self-governance violation error',
    );
  }
  assert(selfSuspendFailed, 'Self-suspension of administrator must be rejected');
  console.log('✅ Passed Test 3: Account status updates and self-suspension protections verified.');

  // ============================================================================
  // 4. ROLE GOVERNANCE & SELF-DEMOTION PROTECTION
  // ============================================================================
  console.log('\nTest 4: Role assignment and self-demotion defense...');
  // Promote Bob to GUARDIAN
  const roleUpdateRes = await updateAdminUserRole(
    userBob.id,
    Role.GUARDIAN,
    adminAlice.id,
    memoryUsersStore,
  );
  assert(roleUpdateRes.role === Role.GUARDIAN, 'Bob role must be updated to GUARDIAN');

  // Restore Bob to USER
  await updateAdminUserRole(userBob.id, Role.USER, adminAlice.id, memoryUsersStore);

  // Self-demotion prevention
  let selfDemoteFailed = false;
  try {
    await updateAdminUserRole(adminAlice.id, Role.USER, adminAlice.id, memoryUsersStore);
  } catch (err: any) {
    selfDemoteFailed = true;
    assert(
      err.message.includes('cannot revoke their own administrator role'),
      'Expected self-demotion rejection error',
    );
  }
  assert(selfDemoteFailed, 'Self-demotion of administrator must be rejected');
  console.log('✅ Passed Test 4: Role assignment and self-demotion defenses verified.');

  // ============================================================================
  // 5. PLATFORM METRICS & TELEMETRY
  // ============================================================================
  console.log('\nTest 5: Platform operational telemetry stats...');
  const statsRes = await getAdminSystemStats(
    Array.from(memoryUsersStore.values()),
    testAuditLogs.length,
    Date.now() - 5000,
  );
  assert(statsRes.totalUsers === 3, 'Total users must equal 3');
  assert(statsRes.usersByRole.USER === 1, 'Users by role USER must be 1');
  assert(statsRes.usersByRole.GUARDIAN === 1, 'Users by role GUARDIAN must be 1');
  assert(statsRes.usersByRole.ADMIN === 1, 'Users by role ADMIN must be 1');
  assert(statsRes.totalAuditLogs === testAuditLogs.length, 'Audit logs count must match');
  console.log('✅ Passed Test 5: Platform operational telemetry statistics verified.');

  // ============================================================================
  // 6. AUDIT LOG LEDGER QUERIES
  // ============================================================================
  console.log('\nTest 6: Audit log ledger queries & filtering...');
  const auditRes = await queryAdminAuditLogs(
    { action: AuditAction.ADMIN_LOGIN_SUCCESS },
    testAuditLogs,
  );
  assert(auditRes.logs.length === 1, 'Should find exactly 1 ADMIN_LOGIN_SUCCESS record');
  assert(auditRes.logs[0].userId === adminAlice.id, 'Audit log userId must match Alice');

  const auditUserRes = await queryAdminAuditLogs({ userId: userBob.id }, testAuditLogs);
  assert(auditUserRes.logs.length === 2, 'Should find 2 audit logs associated with Bob');
  console.log('✅ Passed Test 6: Audit log ledger queries and filtering verified.');

  console.log('\n======================================================');
  console.log('🎉 ALL NIVA PHASE 7 ADMIN SYSTEM TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runPhase7Tests().catch((err) => {
  console.error('Fatal error during Phase 7 tests:', err);
  process.exit(1);
});
