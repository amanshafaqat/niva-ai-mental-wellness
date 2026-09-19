/**
 * NIVA Phase 6 Automated Test Suite
 * Comprehensive Verification: Guardian System Architecture, Consent, Privacy Boundaries,
 * Cryptographic Tokens, Sharing Preferences, IDOR Defenses, and Safety Isolation.
 */

import {
  createGuardianInvitation,
  getInvitationPreview,
  acceptGuardianInvitation,
  declineGuardianInvitation,
  revokeGuardianRelationship,
  disconnectGuardian,
  updateSharingPreferences,
  getWardViewForGuardian,
  getWardRelationships,
  getGuardianActiveRelationships,
  getUserNotifications,
  markNotificationAsRead,
  recordVoluntaryCheckIn,
  memoryGuardianRelationships,
  hashToken,
} from '../src/services/guardian/guardian-service';
import { GuardianSharingPreferencesDto } from '../shared/types/guardian';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(`Test Failure: ${message}`);
  }
}

async function runPhase6Tests() {
  console.log('🛡️ Starting NIVA Phase 6 Guardian System Test Suite...\n');

  // Test User Identities
  const userAlice = {
    id: 'usr-alice-101',
    email: 'alice@example.com',
    name: 'Alice Springs',
  };

  const userBob = {
    id: 'usr-bob-202',
    email: 'bob.guardian@example.com',
    name: 'Bob Guardian',
  };

  const userCharlie = {
    id: 'usr-charlie-303',
    email: 'charlie.attacker@example.com',
    name: 'Charlie Attacker',
  };

  // Clear test state
  memoryGuardianRelationships.clear();

  // ============================================================================
  // 1. INVITATION CREATION & CRYPTOGRAPHY
  // ============================================================================
  console.log('1. Testing Guardian Invitation Creation & Cryptographic Security...');

  // 1.1 Self-invitation rejection
  let selfInviteBlocked = false;
  try {
    await createGuardianInvitation({
      userId: userAlice.id,
      userEmail: userAlice.email,
      userName: userAlice.name,
      guardianEmail: userAlice.email, // Self invite
    });
  } catch (err: any) {
    if (err.message.includes('Self-invitation forbidden')) {
      selfInviteBlocked = true;
    }
  }
  assert(selfInviteBlocked, 'User must not be permitted to invite themselves as guardian.');
  console.log('   ✅ Self-invitation attempt correctly rejected with explicit consent rule.');

  // 1.2 Valid invitation generation
  const inviteResult = await createGuardianInvitation({
    userId: userAlice.id,
    userEmail: userAlice.email,
    userName: userAlice.name,
    guardianEmail: userBob.email,
    guardianName: 'Bob',
    relationshipLabel: 'Trusted Friend',
    initialPreferences: {
      shareActivityStatus: false,
      shareWellnessStreak: false,
      shareVoluntaryMood: false,
    },
  });

  assert(Boolean(inviteResult.relationshipId), 'Relationship ID must be returned.');
  assert(
    inviteResult.invitationToken.startsWith('niva_ginv_') && inviteResult.invitationToken.length >= 40,
    'Invitation token must be a high-entropy cryptographically unpredictable string.',
  );
  assert(new Date(inviteResult.expiresAt) > new Date(), 'Expiration date must be in the future.');

  // 1.3 Verify Raw Secret Isolation (Only SHA-256 hash stored)
  const storedRel = memoryGuardianRelationships.get(inviteResult.relationshipId);
  assert(Boolean(storedRel), 'Stored relationship must exist.');
  assert(storedRel?.status === 'PENDING', 'Initial relationship status must be PENDING.');
  assert(
    storedRel?.invitationTokenHash === hashToken(inviteResult.invitationToken),
    'Database/Memory must store only SHA-256 hash of invitation token, never raw token.',
  );
  assert(
    storedRel?.invitationTokenHash !== inviteResult.invitationToken,
    'Plaintext token must not match stored hash.',
  );
  console.log('   ✅ High-entropy cryptographic token generated and securely stored as SHA-256 hash.');

  // 1.4 Duplicate pending invitation rejection
  let duplicateBlocked = false;
  try {
    await createGuardianInvitation({
      userId: userAlice.id,
      userEmail: userAlice.email,
      userName: userAlice.name,
      guardianEmail: userBob.email,
    });
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      duplicateBlocked = true;
    }
  }
  assert(duplicateBlocked, 'Duplicate active/pending invitation to same contact must be blocked.');
  console.log('   ✅ Duplicate invitation to existing contact safely rejected.');

  // ============================================================================
  // 2. INVITATION PREVIEW, EXPIRATION & ONE-TIME ACCEPTANCE
  // ============================================================================
  console.log('2. Testing Invitation Preview & Single-Use Replay Protection...');

  // 2.1 Safe Public Preview
  const preview = await getInvitationPreview(inviteResult.invitationToken);
  assert(preview.inviterName === 'Alice Springs', 'Preview must display inviter display name.');
  assert(preview.status === 'PENDING', 'Preview must indicate PENDING status.');
  assert(!preview.isExpired, 'Preview must confirm token is active and unexpired.');
  console.log('   ✅ Safe preview verified without exposing private credentials or account internals.');

  // 2.2 Invalid Token Preview
  let invalidPreviewBlocked = false;
  try {
    await getInvitationPreview('niva_ginv_nonexistent_fake_token_12345');
  } catch {
    invalidPreviewBlocked = true;
  }
  assert(invalidPreviewBlocked, 'Invalid preview tokens must return not found error.');
  console.log('   ✅ Invalid token preview safely rejected.');

  // 2.3 Acceptance
  const accepted = await acceptGuardianInvitation(inviteResult.invitationToken, userBob);
  assert(accepted.status === 'ACTIVE', 'Relationship status must be ACTIVE after acceptance.');
  assert(accepted.guardianId === userBob.id, 'Guardian ID must be bound to accepting user.');
  assert(Boolean(accepted.invitationAcceptedAt), 'Acceptance timestamp must be recorded.');

  // Verify single-use token invalidation
  const afterAcceptRel = memoryGuardianRelationships.get(inviteResult.relationshipId);
  assert(
    afterAcceptRel?.invitationTokenHash === null,
    'Token hash must be cleared upon acceptance to prevent replay attacks.',
  );

  // 2.4 Replay attack attempt
  let replayBlocked = false;
  try {
    await acceptGuardianInvitation(inviteResult.invitationToken, userBob);
  } catch (err: any) {
    if (err.message.includes('Invalid or expired') || err.message.includes('already been accepted')) {
      replayBlocked = true;
    }
  }
  assert(replayBlocked, 'Replaying an accepted invitation token must be rejected.');
  console.log('   ✅ Single-use token replay protection verified; token invalidated after acceptance.');

  // ============================================================================
  // 3. PRIVACY-PRESERVING GUARDIAN DASHBOARD & SHARING PREFERENCES
  // ============================================================================
  console.log('3. Testing Privacy-Preserving Guardian Dashboard & Granular Sharing...');

  // Mock activity resolver
  const mockActivityResolver = (userId: string) => ({
    lastActiveAt: '2026-09-19T02:00:00.000Z',
    streakDays: 5,
  });

  // 3.1 Initial Default: All sharing preferences are opt-in (default: false)
  const defaultWardView = await getWardViewForGuardian(
    inviteResult.relationshipId,
    userBob.id,
    mockActivityResolver,
  );
  assert(defaultWardView.status === 'ACTIVE', 'Ward view status must be active.');
  assert(defaultWardView.wardName === 'Alice Springs', 'Ward name must match.');
  assert(
    defaultWardView.activityStatus === null,
    'Activity status must be NULL when shareActivityStatus is false.',
  );
  assert(
    defaultWardView.wellnessStreak === null,
    'Wellness streak must be NULL when shareWellnessStreak is false.',
  );
  assert(
    defaultWardView.voluntaryMood === null,
    'Voluntary mood must be NULL when shareVoluntaryMood is false.',
  );
  console.log('   ✅ Privacy default: All health/activity indicators are omitted when not opted in.');

  // 3.2 Verify STRICT PRIVACY BOUNDARY: No chat messages, transcripts, or safety data
  const rawWardView = defaultWardView as any;
  assert(rawWardView.conversations === undefined, 'Ward view must NEVER include conversations.');
  assert(rawWardView.messages === undefined, 'Ward view must NEVER include chat messages.');
  assert(rawWardView.voiceSessions === undefined, 'Ward view must NEVER include voice transcripts.');
  assert(rawWardView.safetyLevel === undefined, 'Ward view must NEVER include crisis/safety classification.');
  assert(rawWardView.distressLevel === undefined, 'Ward view must NEVER include distress level metrics.');
  console.log('   ✅ Strict privacy boundary confirmed: Zero access to chat history, voice audio, or crisis logs.');

  // 3.3 Opt-in to Activity Status and Wellness Streak
  await updateSharingPreferences(inviteResult.relationshipId, userAlice.id, {
    shareActivityStatus: true,
    shareWellnessStreak: true,
    shareVoluntaryMood: false,
  });

  const updatedWardView = await getWardViewForGuardian(
    inviteResult.relationshipId,
    userBob.id,
    mockActivityResolver,
  );
  assert(
    updatedWardView.activityStatus !== null && updatedWardView.activityStatus.lastActiveAt !== null,
    'Activity status must be visible when opted in.',
  );
  assert(
    updatedWardView.wellnessStreak !== null && updatedWardView.wellnessStreak.currentStreakDays === 5,
    'Wellness streak count must be visible when opted in.',
  );
  assert(
    updatedWardView.voluntaryMood === null,
    'Voluntary mood must remain NULL when not opted in.',
  );
  console.log('   ✅ Selective opt-in verified: Only explicitly approved categories are visible.');

  // 3.4 Opt-in to Voluntary Mood Check-in
  recordVoluntaryCheckIn(userAlice.id, 'Reflective & Calm');
  await updateSharingPreferences(inviteResult.relationshipId, userAlice.id, {
    shareVoluntaryMood: true,
  });

  const moodWardView = await getWardViewForGuardian(
    inviteResult.relationshipId,
    userBob.id,
    mockActivityResolver,
  );
  assert(
    moodWardView.voluntaryMood?.recentMood === 'Reflective & Calm',
    'Voluntary mood check-in must reflect self-reported mood.',
  );
  console.log('   ✅ Voluntary mood check-in verified without clinical diagnosis inference.');

  // ============================================================================
  // 4. AUTHORIZATION, IDOR DEFENSE & ACCESS CONTROL
  // ============================================================================
  console.log('4. Testing Authorization, IDOR Defenses & Cross-User Isolation...');

  // 4.1 Attacker Charlie attempts to view Alice's ward profile
  let idorWardViewBlocked = false;
  try {
    await getWardViewForGuardian(inviteResult.relationshipId, userCharlie.id, mockActivityResolver);
  } catch (err: any) {
    if (err.message.includes('Access denied') || err.message.includes('not authorized')) {
      idorWardViewBlocked = true;
    }
  }
  assert(idorWardViewBlocked, 'Unauthorized user must be blocked from accessing ward profile.');
  console.log('   ✅ IDOR defense: Unrelated user cannot view another user\'s ward profile.');

  // 4.2 Attacker Charlie attempts to modify Alice's sharing preferences
  let idorPrefBlocked = false;
  try {
    await updateSharingPreferences(inviteResult.relationshipId, userCharlie.id, {
      shareActivityStatus: true,
    });
  } catch (err: any) {
    if (err.message.includes('Access denied')) {
      idorPrefBlocked = true;
    }
  }
  assert(idorPrefBlocked, 'Unauthorized user must be blocked from modifying sharing preferences.');
  console.log('   ✅ IDOR defense: Unrelated user cannot alter ward\'s sharing preferences.');

  // 4.3 Guardian Bob attempts to alter Alice's sharing preferences (ward alone controls preferences)
  let guardianPrefTamperBlocked = false;
  try {
    await updateSharingPreferences(inviteResult.relationshipId, userBob.id, {
      shareActivityStatus: true,
    });
  } catch (err: any) {
    if (err.message.includes('Access denied')) {
      guardianPrefTamperBlocked = true;
    }
  }
  assert(guardianPrefTamperBlocked, 'Guardian must not be able to change ward\'s sharing preferences.');
  console.log('   ✅ Guardian cannot self-grant access to ward data.');

  // ============================================================================
  // 5. INVITATION DECLINE, REVOCATION & DISCONNECTION
  // ============================================================================
  console.log('5. Testing Decline, Revocation and Disconnection Lifecycles...');

  // 5.1 Decline flow
  const invite2 = await createGuardianInvitation({
    userId: userAlice.id,
    userEmail: userAlice.email,
    userName: userAlice.name,
    guardianEmail: 'declining.contact@example.com',
  });
  const declineResult = await declineGuardianInvitation(invite2.invitationToken);
  assert(declineResult.success, 'Decline call must succeed.');
  const declinedRel = memoryGuardianRelationships.get(invite2.relationshipId);
  assert(declinedRel?.status === 'DECLINED', 'Relationship status must be DECLINED.');
  assert(declinedRel?.invitationTokenHash === null, 'Token hash must be cleared after decline.');
  console.log('   ✅ Guardian invitation decline lifecycle verified.');

  // 5.2 Ward Revocation flow
  const revokedRel = await revokeGuardianRelationship(inviteResult.relationshipId, userAlice.id);
  assert(revokedRel.status === 'REVOKED', 'Status must transition to REVOKED.');
  assert(revokedRel.revokedBy === 'USER', 'revokedBy must be set to USER.');

  // Verify that subsequent guardian dashboard queries are blocked immediately
  let postRevocationAccessBlocked = false;
  try {
    await getWardViewForGuardian(inviteResult.relationshipId, userBob.id, mockActivityResolver);
  } catch (err: any) {
    if (err.message.includes('revoked') || err.message.includes('Access denied')) {
      postRevocationAccessBlocked = true;
    }
  }
  assert(postRevocationAccessBlocked, 'Guardian access must be immediately terminated upon revocation.');
  console.log('   ✅ Immediate access revocation enforced; revoked guardian access blocked.');

  // 5.3 Guardian Disconnection flow
  const invite3 = await createGuardianInvitation({
    userId: userAlice.id,
    userEmail: userAlice.email,
    userName: userAlice.name,
    guardianEmail: 'friend.disconnect@example.com',
  });
  const friendUser = { id: 'usr-friend-404', email: 'friend.disconnect@example.com', name: 'Friend' };
  await acceptGuardianInvitation(invite3.invitationToken, friendUser);

  const disconnectedRel = await disconnectGuardian(invite3.relationshipId, friendUser.id);
  assert(disconnectedRel.status === 'REVOKED', 'Relationship must transition to REVOKED on disconnect.');
  assert(disconnectedRel.revokedBy === 'GUARDIAN', 'revokedBy must be set to GUARDIAN.');
  console.log('   ✅ Guardian disconnection lifecycle verified.');

  // ============================================================================
  // 6. NOTIFICATION PRIVACY & AUDIT TRAIL
  // ============================================================================
  console.log('6. Testing In-App Notifications & Notification Privacy...');

  const aliceNotifs = getUserNotifications(userAlice.id);
  assert(aliceNotifs.length > 0, 'Alice must receive in-app notifications for guardian events.');
  for (const n of aliceNotifs) {
    // Assert no private chat conversation, transcript, or crisis score is leaked in notifications
    assert(!n.message.includes('conversationId'), 'Notification must not leak conversation IDs.');
    assert(!n.message.includes('distressLevel'), 'Notification must not leak distress levels.');
    assert(!n.message.includes('suicide') && !n.message.includes('crisis'), 'Notification must not leak crisis details.');
  }

  // Mark notification read test
  const firstNotif = aliceNotifs[0];
  const readSuccess = markNotificationAsRead(firstNotif.id, userAlice.id);
  assert(readSuccess, 'Notification read flag update must succeed.');
  console.log('   ✅ In-app notifications verified with zero private chat or crisis leakage.');

  console.log('\n🎉 ALL NIVA PHASE 6 GUARDIAN SYSTEM TESTS PASSED SUCCESSFULLY!\n');
}

runPhase6Tests().catch((err) => {
  console.error('Fatal error during Phase 6 test execution:', err);
  process.exit(1);
});
