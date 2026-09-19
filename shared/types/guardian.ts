/**
 * NIVA Phase 6: Guardian System Shared Types
 * Privacy-preserving, consent-driven guardian relationship models.
 */

export type GuardianRelationshipStatus = 'PENDING' | 'ACTIVE' | 'DECLINED' | 'REVOKED';

export type GuardianNotificationType =
  | 'INVITATION_RECEIVED'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_DECLINED'
  | 'RELATIONSHIP_REVOKED'
  | 'GUARDIAN_DISCONNECTED'
  | 'PREFERENCES_UPDATED';

export interface GuardianSharingPreferencesDto {
  shareActivityStatus: boolean; // Daily wellness check-in / last active
  shareWellnessStreak: boolean; // Consecutive days checked in
  shareVoluntaryMood: boolean; // Voluntary check-in mood rating (not chat/AI inferences)
  consentRecordedAt?: string;
  updatedAt?: string;
}

export interface GuardianRelationshipDto {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  guardianId?: string | null;
  guardianEmail: string;
  guardianName?: string | null;
  relationshipLabel?: string | null;
  status: GuardianRelationshipStatus;
  createdAt: string;
  invitationAcceptedAt?: string | null;
  revokedAt?: string | null;
  revokedBy?: 'USER' | 'GUARDIAN' | null;
  sharingPreferences: GuardianSharingPreferencesDto;
}

export interface GuardianInvitationResultDto {
  relationshipId: string;
  invitationToken: string; // Only delivered to inviter at creation
  expiresAt: string;
  guardianEmail: string;
  guardianName?: string | null;
  relationshipLabel?: string | null;
}

export interface GuardianWardViewDto {
  relationshipId: string;
  wardId: string;
  wardName: string;
  relationshipLabel?: string | null;
  status: GuardianRelationshipStatus;
  connectedSince?: string | null;
  activityStatus?: {
    lastActiveAt: string | null;
    checkedInToday: boolean;
  } | null;
  wellnessStreak?: {
    currentStreakDays: number;
  } | null;
  voluntaryMood?: {
    recentMood: string | null;
    recordedAt: string | null;
  } | null;
  sharingSettingsSummary: {
    activityStatusEnabled: boolean;
    wellnessStreakEnabled: boolean;
    voluntaryMoodEnabled: boolean;
  };
}

export interface GuardianNotificationDto {
  id: string;
  userId: string;
  relationshipId?: string | null;
  type: GuardianNotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface InvitationPreviewDto {
  relationshipId: string;
  inviterName: string;
  guardianEmail: string;
  relationshipLabel?: string | null;
  expiresAt: string;
  status: GuardianRelationshipStatus;
  isExpired: boolean;
}
