/**
 * NIVA Phase 6: Guardian System Service
 * Privacy-preserving, cryptographically secure, consent-driven guardian relationship engine.
 */

import crypto from 'crypto';
import { getPrismaClient, isDatabaseConnected } from '../../lib/prisma';
import {
  GuardianRelationshipDto,
  GuardianSharingPreferencesDto,
  GuardianInvitationResultDto,
  GuardianWardViewDto,
  GuardianNotificationDto,
  InvitationPreviewDto,
  GuardianRelationshipStatus,
} from '../../../shared/types/guardian';

export interface InMemoryGuardianRelationship {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  guardianId: string | null;
  guardianEmail: string;
  guardianName: string | null;
  relationshipLabel: string | null;
  status: GuardianRelationshipStatus;
  invitationTokenHash: string | null;
  invitationTokenExpiresAt: string | null;
  invitationAcceptedAt: string | null;
  invitationDeclinedAt: string | null;
  revokedAt: string | null;
  revokedBy: 'USER' | 'GUARDIAN' | null;
  createdAt: string;
  updatedAt: string;
  sharingPreferences: GuardianSharingPreferencesDto;
}

export interface InMemoryVoluntaryCheckIn {
  id: string;
  userId: string;
  mood: string;
  recordedAt: string;
}

// In-memory stores for runtime performance and development fallback
export const memoryGuardianRelationships = new Map<string, InMemoryGuardianRelationship>();
export const memoryGuardianNotifications: GuardianNotificationDto[] = [];
export const memoryVoluntaryCheckIns = new Map<string, InMemoryVoluntaryCheckIn[]>();

// Rate limit tracker for guardian invitations (max 5 per 15 minutes per user)
const invitationRateLimits = new Map<string, number[]>();

function checkInvitationRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const timestamps = (invitationRateLimits.get(userId) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= 5) {
    return false;
  }
  timestamps.push(now);
  invitationRateLimits.set(userId, timestamps);
  return true;
}

/**
 * SHA-256 hash helper for secure token storage
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Create a secure, single-use, cryptographically unpredictable guardian invitation
 */
export async function createGuardianInvitation(params: {
  userId: string;
  userEmail: string;
  userName: string;
  guardianEmail: string;
  guardianName?: string | null;
  relationshipLabel?: string | null;
  initialPreferences?: Partial<GuardianSharingPreferencesDto>;
}): Promise<GuardianInvitationResultDto> {
  const { userId, userEmail, userName, guardianEmail, guardianName, relationshipLabel, initialPreferences } =
    params;

  const normalizedGuardianEmail = guardianEmail.toLowerCase().trim();
  const normalizedUserEmail = userEmail.toLowerCase().trim();

  // 1. Consent Rule: User cannot invite themselves
  if (normalizedGuardianEmail === normalizedUserEmail) {
    throw new Error('Self-invitation forbidden: You cannot invite yourself as your own guardian.');
  }

  // 2. Rate limit protection
  if (!checkInvitationRateLimit(userId)) {
    throw new Error('Invitation rate limit exceeded. Please wait a few minutes before inviting another guardian.');
  }

  // 3. Duplicate active/pending relationship check
  for (const rel of memoryGuardianRelationships.values()) {
    if (
      rel.userId === userId &&
      rel.guardianEmail.toLowerCase() === normalizedGuardianEmail &&
      (rel.status === 'ACTIVE' || rel.status === 'PENDING')
    ) {
      throw new Error(`An active or pending guardian relationship already exists for ${guardianEmail}.`);
    }
  }

  // 4. Generate 256-bit cryptographically secure unpredictable invitation token
  const rawToken = `niva_ginv_${crypto.randomBytes(32).toString('hex')}`;
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days validity
  const relId = `grel-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  const sharingPreferences: GuardianSharingPreferencesDto = {
    shareActivityStatus: Boolean(initialPreferences?.shareActivityStatus),
    shareWellnessStreak: Boolean(initialPreferences?.shareWellnessStreak),
    shareVoluntaryMood: Boolean(initialPreferences?.shareVoluntaryMood),
    consentRecordedAt: now,
    updatedAt: now,
  };

  const relationship: InMemoryGuardianRelationship = {
    id: relId,
    userId,
    userName: userName || 'NIVA User',
    userEmail: normalizedUserEmail,
    guardianId: null,
    guardianEmail: normalizedGuardianEmail,
    guardianName: guardianName?.trim() || null,
    relationshipLabel: relationshipLabel?.trim() || 'Trusted Contact',
    status: 'PENDING',
    invitationTokenHash: tokenHash,
    invitationTokenExpiresAt: expiresAt,
    invitationAcceptedAt: null,
    invitationDeclinedAt: null,
    revokedAt: null,
    revokedBy: null,
    createdAt: now,
    updatedAt: now,
    sharingPreferences,
  };

  memoryGuardianRelationships.set(relId, relationship);

  // Attempt durable persistence in Prisma if database is connected
  try {
    const isDbReady = await isDatabaseConnected();
    if (isDbReady) {
      const prisma = getPrismaClient();
      await prisma.guardianRelationship.create({
        data: {
          id: relId,
          userId,
          guardianEmail: normalizedGuardianEmail,
          guardianName: guardianName?.trim() || null,
          relationshipLabel: relationshipLabel?.trim() || 'Trusted Contact',
          status: 'PENDING',
          invitationTokenHash: tokenHash,
          invitationTokenExpiresAt: new Date(expiresAt),
          sharingPreferences: {
            create: {
              shareActivityStatus: sharingPreferences.shareActivityStatus,
              shareWellnessStreak: sharingPreferences.shareWellnessStreak,
              shareVoluntaryMood: sharingPreferences.shareVoluntaryMood,
            },
          },
        },
      });
    }
  } catch (err: any) {
    console.warn('Prisma guardian persistence notice:', err?.message || err);
  }

  // Add in-app notification for the user confirming dispatch
  addNotification({
    userId,
    relationshipId: relId,
    type: 'INVITATION_RECEIVED',
    title: 'Guardian Invitation Created',
    message: `Invitation link generated for ${guardianName || guardianEmail}. It will expire in 7 days.`,
  });

  return {
    relationshipId: relId,
    invitationToken: rawToken,
    expiresAt,
    guardianEmail: normalizedGuardianEmail,
    guardianName: relationship.guardianName,
    relationshipLabel: relationship.relationshipLabel,
  };
}

/**
 * Public preview of an invitation token (safe, non-sensitive metadata)
 */
export async function getInvitationPreview(rawToken: string): Promise<InvitationPreviewDto> {
  const tokenHash = hashToken(rawToken);

  let rel: InMemoryGuardianRelationship | null = null;
  for (const r of memoryGuardianRelationships.values()) {
    if (r.invitationTokenHash === tokenHash) {
      rel = r;
      break;
    }
  }

  if (!rel) {
    throw new Error('Invalid or expired invitation token.');
  }

  const isExpired = Boolean(rel.invitationTokenExpiresAt && new Date(rel.invitationTokenExpiresAt) < new Date());

  return {
    relationshipId: rel.id,
    inviterName: rel.userName || 'A NIVA User',
    guardianEmail: rel.guardianEmail,
    relationshipLabel: rel.relationshipLabel,
    expiresAt: rel.invitationTokenExpiresAt || '',
    status: rel.status,
    isExpired,
  };
}

/**
 * Accept a guardian invitation with authenticated user credentials
 */
export async function acceptGuardianInvitation(
  rawToken: string,
  guardianUser: { id: string; email: string; name?: string | null },
): Promise<GuardianRelationshipDto> {
  const tokenHash = hashToken(rawToken);

  let rel: InMemoryGuardianRelationship | null = null;
  for (const r of memoryGuardianRelationships.values()) {
    if (r.invitationTokenHash === tokenHash) {
      rel = r;
      break;
    }
  }

  if (!rel) {
    throw new Error('Invalid or expired invitation token.');
  }

  if (rel.status === 'ACTIVE') {
    throw new Error('This invitation has already been accepted and is active.');
  }

  if (rel.status === 'REVOKED') {
    throw new Error('This invitation was revoked by the user.');
  }

  if (rel.status === 'DECLINED') {
    throw new Error('This invitation was previously declined.');
  }

  if (rel.invitationTokenExpiresAt && new Date(rel.invitationTokenExpiresAt) < new Date()) {
    throw new Error('This invitation has expired. Please ask the user to send a new invitation.');
  }

  // Prevent self-acceptance
  if (rel.userId === guardianUser.id) {
    throw new Error('Security boundary: You cannot accept an invitation to be your own guardian.');
  }

  const now = new Date().toISOString();
  rel.status = 'ACTIVE';
  rel.guardianId = guardianUser.id;
  rel.guardianName = guardianUser.name || rel.guardianName;
  rel.invitationAcceptedAt = now;
  rel.updatedAt = now;
  // Clear token hash to enforce single-use replay protection
  rel.invitationTokenHash = null;

  // Persist to Prisma if available
  try {
    const isDbReady = await isDatabaseConnected();
    if (isDbReady) {
      const prisma = getPrismaClient();
      await prisma.guardianRelationship.update({
        where: { id: rel.id },
        data: {
          status: 'ACTIVE',
          guardianId: guardianUser.id,
          guardianName: rel.guardianName,
          invitationAcceptedAt: new Date(now),
          invitationTokenHash: null,
        },
      });
    }
  } catch (err: any) {
    console.warn('Prisma guardian update notice:', err?.message || err);
  }

  // Notify ward of guardian acceptance
  addNotification({
    userId: rel.userId,
    relationshipId: rel.id,
    type: 'INVITATION_ACCEPTED',
    title: 'Guardian Connected',
    message: `${guardianUser.name || guardianUser.email} has accepted your invitation and is now connected as your trusted guardian.`,
  });

  // Notify guardian of successful connection
  addNotification({
    userId: guardianUser.id,
    relationshipId: rel.id,
    type: 'INVITATION_ACCEPTED',
    title: 'Guardian Connection Active',
    message: `You are now connected as a trusted guardian for ${rel.userName}. You can view permitted wellness indicators in your Guardian Dashboard.`,
  });

  return toRelationshipDto(rel);
}

/**
 * Decline a guardian invitation
 */
export async function declineGuardianInvitation(
  rawToken: string,
  guardianUser?: { id: string; email: string } | null,
): Promise<{ success: boolean; message: string }> {
  const tokenHash = hashToken(rawToken);

  let rel: InMemoryGuardianRelationship | null = null;
  for (const r of memoryGuardianRelationships.values()) {
    if (r.invitationTokenHash === tokenHash) {
      rel = r;
      break;
    }
  }

  if (!rel) {
    throw new Error('Invalid or expired invitation token.');
  }

  if (rel.status !== 'PENDING') {
    throw new Error(`Invitation cannot be declined because it is already ${rel.status.toLowerCase()}.`);
  }

  const now = new Date().toISOString();
  rel.status = 'DECLINED';
  rel.invitationDeclinedAt = now;
  rel.updatedAt = now;
  rel.invitationTokenHash = null;

  try {
    const isDbReady = await isDatabaseConnected();
    if (isDbReady) {
      const prisma = getPrismaClient();
      await prisma.guardianRelationship.update({
        where: { id: rel.id },
        data: {
          status: 'DECLINED',
          invitationDeclinedAt: new Date(now),
          invitationTokenHash: null,
        },
      });
    }
  } catch (err: any) {
    console.warn('Prisma guardian decline notice:', err?.message || err);
  }

  // Notify ward
  addNotification({
    userId: rel.userId,
    relationshipId: rel.id,
    type: 'INVITATION_DECLINED',
    title: 'Invitation Declined',
    message: `Your guardian invitation to ${rel.guardianEmail} was declined.`,
  });

  return { success: true, message: 'Invitation declined successfully.' };
}

/**
 * Ward revoking a guardian relationship
 */
export async function revokeGuardianRelationship(
  relationshipId: string,
  userId: string,
): Promise<GuardianRelationshipDto> {
  const rel = memoryGuardianRelationships.get(relationshipId);
  if (!rel) {
    throw new Error('Guardian relationship not found.');
  }

  // Authorization: Only the ward owning this relationship can revoke it
  if (rel.userId !== userId) {
    throw new Error('Access denied: You do not have permission to revoke this relationship.');
  }

  const now = new Date().toISOString();
  rel.status = 'REVOKED';
  rel.revokedAt = now;
  rel.revokedBy = 'USER';
  rel.updatedAt = now;
  rel.invitationTokenHash = null;

  try {
    const isDbReady = await isDatabaseConnected();
    if (isDbReady) {
      const prisma = getPrismaClient();
      await prisma.guardianRelationship.update({
        where: { id: rel.id },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(now),
          revokedBy: 'USER',
          invitationTokenHash: null,
        },
      });
    }
  } catch (err: any) {
    console.warn('Prisma guardian revoke notice:', err?.message || err);
  }

  // Notify guardian if one was connected
  if (rel.guardianId) {
    addNotification({
      userId: rel.guardianId,
      relationshipId: rel.id,
      type: 'RELATIONSHIP_REVOKED',
      title: 'Connection Disconnected',
      message: `${rel.userName} has ended the guardian connection. You no longer have access to their dashboard.`,
    });
  }

  // Notify ward
  addNotification({
    userId: rel.userId,
    relationshipId: rel.id,
    type: 'RELATIONSHIP_REVOKED',
    title: 'Guardian Revoked',
    message: `You have successfully revoked guardian access for ${rel.guardianName || rel.guardianEmail}.`,
  });

  return toRelationshipDto(rel);
}

/**
 * Guardian leaving / disconnecting from a relationship
 */
export async function disconnectGuardian(
  relationshipId: string,
  guardianId: string,
): Promise<GuardianRelationshipDto> {
  const rel = memoryGuardianRelationships.get(relationshipId);
  if (!rel) {
    throw new Error('Guardian relationship not found.');
  }

  // Authorization: Only the active guardian can disconnect themselves
  if (rel.guardianId !== guardianId) {
    throw new Error('Access denied: You are not the assigned guardian for this relationship.');
  }

  const now = new Date().toISOString();
  rel.status = 'REVOKED';
  rel.revokedAt = now;
  rel.revokedBy = 'GUARDIAN';
  rel.updatedAt = now;

  try {
    const isDbReady = await isDatabaseConnected();
    if (isDbReady) {
      const prisma = getPrismaClient();
      await prisma.guardianRelationship.update({
        where: { id: rel.id },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(now),
          revokedBy: 'GUARDIAN',
        },
      });
    }
  } catch (err: any) {
    console.warn('Prisma guardian disconnect notice:', err?.message || err);
  }

  // Notify ward
  addNotification({
    userId: rel.userId,
    relationshipId: rel.id,
    type: 'GUARDIAN_DISCONNECTED',
    title: 'Guardian Disconnected',
    message: `${rel.guardianName || rel.guardianEmail} has disconnected from being your guardian.`,
  });

  return toRelationshipDto(rel);
}

/**
 * Update sharing preferences for a relationship (only ward can alter)
 */
export async function updateSharingPreferences(
  relationshipId: string,
  userId: string,
  preferences: Partial<GuardianSharingPreferencesDto>,
): Promise<GuardianSharingPreferencesDto> {
  const rel = memoryGuardianRelationships.get(relationshipId);
  if (!rel) {
    throw new Error('Guardian relationship not found.');
  }

  // Strict ownership: Ward alone controls their sharing preferences
  if (rel.userId !== userId) {
    throw new Error('Access denied: Only the account owner can modify sharing preferences.');
  }

  const now = new Date().toISOString();
  rel.sharingPreferences = {
    shareActivityStatus:
      preferences.shareActivityStatus !== undefined
        ? Boolean(preferences.shareActivityStatus)
        : rel.sharingPreferences.shareActivityStatus,
    shareWellnessStreak:
      preferences.shareWellnessStreak !== undefined
        ? Boolean(preferences.shareWellnessStreak)
        : rel.sharingPreferences.shareWellnessStreak,
    shareVoluntaryMood:
      preferences.shareVoluntaryMood !== undefined
        ? Boolean(preferences.shareVoluntaryMood)
        : rel.sharingPreferences.shareVoluntaryMood,
    consentRecordedAt: now,
    updatedAt: now,
  };
  rel.updatedAt = now;

  try {
    const isDbReady = await isDatabaseConnected();
    if (isDbReady) {
      const prisma = getPrismaClient();
      await prisma.guardianSharingPreferences.upsert({
        where: { relationshipId },
        create: {
          relationshipId,
          shareActivityStatus: rel.sharingPreferences.shareActivityStatus,
          shareWellnessStreak: rel.sharingPreferences.shareWellnessStreak,
          shareVoluntaryMood: rel.sharingPreferences.shareVoluntaryMood,
        },
        update: {
          shareActivityStatus: rel.sharingPreferences.shareActivityStatus,
          shareWellnessStreak: rel.sharingPreferences.shareWellnessStreak,
          shareVoluntaryMood: rel.sharingPreferences.shareVoluntaryMood,
        },
      });
    }
  } catch (err: any) {
    console.warn('Prisma guardian preferences update notice:', err?.message || err);
  }

  addNotification({
    userId,
    relationshipId,
    type: 'PREFERENCES_UPDATED',
    title: 'Sharing Preferences Updated',
    message: `Sharing settings for ${rel.guardianName || rel.guardianEmail} updated successfully.`,
  });

  return rel.sharingPreferences;
}

/**
 * Record a voluntary wellness check-in by the user
 */
export function recordVoluntaryCheckIn(userId: string, mood: string): InMemoryVoluntaryCheckIn {
  const checkIn: InMemoryVoluntaryCheckIn = {
    id: `chk-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    userId,
    mood: mood.trim(),
    recordedAt: new Date().toISOString(),
  };

  const existing = memoryVoluntaryCheckIns.get(userId) || [];
  existing.unshift(checkIn);
  if (existing.length > 50) existing.pop();
  memoryVoluntaryCheckIns.set(userId, existing);

  return checkIn;
}

/**
 * Privacy-Preserving Guardian Dashboard view of a Ward
 * Strictly prevents access to conversations, transcripts, and safety classifications.
 */
export async function getWardViewForGuardian(
  relationshipId: string,
  guardianId: string,
  userLastActiveResolver?: (userId: string) => { lastActiveAt: string | null; streakDays: number },
): Promise<GuardianWardViewDto> {
  const rel = memoryGuardianRelationships.get(relationshipId);
  if (!rel) {
    throw new Error('Guardian relationship not found.');
  }

  // Enforce Authorization: Caller must be the assigned guardian
  if (rel.guardianId !== guardianId) {
    throw new Error('Access denied: You are not authorized to view this ward profile.');
  }

  // Enforce Active Status: Disconnected or revoked relationships have zero data access
  if (rel.status !== 'ACTIVE') {
    throw new Error(`Access denied: This guardian relationship is ${rel.status.toLowerCase()}.`);
  }

  const prefs = rel.sharingPreferences;

  // Resolve general activity metrics (if permitted)
  let activityStatus: GuardianWardViewDto['activityStatus'] = null;
  let wellnessStreak: GuardianWardViewDto['wellnessStreak'] = null;
  let voluntaryMood: GuardianWardViewDto['voluntaryMood'] = null;

  const activityData = userLastActiveResolver ? userLastActiveResolver(rel.userId) : { lastActiveAt: null, streakDays: 1 };

  if (prefs.shareActivityStatus) {
    const lastActive = activityData.lastActiveAt || rel.updatedAt;
    const isToday = lastActive ? new Date(lastActive).toDateString() === new Date().toDateString() : false;
    activityStatus = {
      lastActiveAt: lastActive,
      checkedInToday: isToday,
    };
  }

  if (prefs.shareWellnessStreak) {
    wellnessStreak = {
      currentStreakDays: activityData.streakDays || 1,
    };
  }

  if (prefs.shareVoluntaryMood) {
    const userCheckIns = memoryVoluntaryCheckIns.get(rel.userId) || [];
    const latest = userCheckIns[0];
    if (latest) {
      voluntaryMood = {
        recentMood: latest.mood,
        recordedAt: latest.recordedAt,
      };
    }
  }

  return {
    relationshipId: rel.id,
    wardId: rel.userId,
    wardName: rel.userName || 'Ward',
    relationshipLabel: rel.relationshipLabel,
    status: rel.status,
    connectedSince: rel.invitationAcceptedAt,
    activityStatus,
    wellnessStreak,
    voluntaryMood,
    sharingSettingsSummary: {
      activityStatusEnabled: prefs.shareActivityStatus,
      wellnessStreakEnabled: prefs.shareWellnessStreak,
      voluntaryMoodEnabled: prefs.shareVoluntaryMood,
    },
  };
}

/**
 * Get all guardian relationships where the caller is the ward
 */
export function getWardRelationships(userId: string): GuardianRelationshipDto[] {
  return Array.from(memoryGuardianRelationships.values())
    .filter((r) => r.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(toRelationshipDto);
}

/**
 * Get all active relationships where the caller is the trusted guardian
 */
export function getGuardianActiveRelationships(guardianId: string): GuardianRelationshipDto[] {
  return Array.from(memoryGuardianRelationships.values())
    .filter((r) => r.guardianId === guardianId && r.status === 'ACTIVE')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(toRelationshipDto);
}

/**
 * In-app Notification management
 */
export function addNotification(params: {
  userId: string;
  relationshipId?: string | null;
  type: GuardianNotificationDto['type'];
  title: string;
  message: string;
}): GuardianNotificationDto {
  const notif: GuardianNotificationDto = {
    id: `notif-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    userId: params.userId,
    relationshipId: params.relationshipId || null,
    type: params.type,
    title: params.title,
    message: params.message,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  memoryGuardianNotifications.unshift(notif);
  if (memoryGuardianNotifications.length > 500) {
    memoryGuardianNotifications.pop();
  }

  return notif;
}

export function getUserNotifications(userId: string): GuardianNotificationDto[] {
  return memoryGuardianNotifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function markNotificationAsRead(notificationId: string, userId: string): boolean {
  const notif = memoryGuardianNotifications.find((n) => n.id === notificationId && n.userId === userId);
  if (notif) {
    notif.isRead = true;
    return true;
  }
  return false;
}

function toRelationshipDto(r: InMemoryGuardianRelationship): GuardianRelationshipDto {
  return {
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    userEmail: r.userEmail,
    guardianId: r.guardianId,
    guardianEmail: r.guardianEmail,
    guardianName: r.guardianName,
    relationshipLabel: r.relationshipLabel,
    status: r.status,
    createdAt: r.createdAt,
    invitationAcceptedAt: r.invitationAcceptedAt,
    revokedAt: r.revokedAt,
    revokedBy: r.revokedBy,
    sharingPreferences: { ...r.sharingPreferences },
  };
}
