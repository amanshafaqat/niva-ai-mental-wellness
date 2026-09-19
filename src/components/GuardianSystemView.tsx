/**
 * NIVA Phase 6: Guardian System View Component
 * Privacy-preserving, consent-first guardian network management and oversight.
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  HeartHandshake,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Clock,
  Lock,
  EyeOff,
  Flame,
  Activity,
  Smile,
  AlertCircle,
  Trash2,
  Bell,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import {
  GuardianRelationshipDto,
  GuardianWardViewDto,
  GuardianNotificationDto,
  InvitationPreviewDto,
} from '../../shared/types/guardian';

export const GuardianSystemView: React.FC = () => {
  const { session } = useAuth();
  const [subTab, setSubTab] = useState<'my-guardians' | 'guardian-dashboard' | 'accept-invite' | 'notifications'>('my-guardians');

  // Ward data
  const [relationships, setRelationships] = useState<GuardianRelationshipDto[]>([]);
  const [isLoadingRelationships, setIsLoadingRelationships] = useState(false);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [relationshipLabel, setRelationshipLabel] = useState('Friend');
  const [prefActivity, setPrefActivity] = useState(false);
  const [prefStreak, setPrefStreak] = useState(false);
  const [prefMood, setPrefMood] = useState(false);
  const [createdTokenResult, setCreatedTokenResult] = useState<{ token: string; expiresAt: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  // Voluntary mood check-in state
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodSuccessMessage, setMoodSuccessMessage] = useState<string | null>(null);

  // Guardian dashboard data
  const [wards, setWards] = useState<GuardianRelationshipDto[]>([]);
  const [selectedWardView, setSelectedWardView] = useState<GuardianWardViewDto | null>(null);
  const [isLoadingWards, setIsLoadingWards] = useState(false);
  const [wardViewError, setWardViewError] = useState<string | null>(null);

  // Accept invite state
  const [inputToken, setInputToken] = useState('');
  const [previewData, setPreviewData] = useState<InvitationPreviewDto | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [acceptMessage, setAcceptMessage] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState<GuardianNotificationDto[]>([]);

  // Load ward relationships
  const loadRelationships = async () => {
    setIsLoadingRelationships(true);
    try {
      const res = await fetch('/api/guardian/relationships', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setRelationships(data.relationships || []);
      }
    } catch (err) {
      console.error('Failed to load guardian relationships:', err);
    } finally {
      setIsLoadingRelationships(false);
    }
  };

  // Load guardian wards
  const loadWards = async () => {
    setIsLoadingWards(true);
    try {
      const res = await fetch('/api/guardian/wards', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setWards(data.wards || []);
        if (data.wards?.length > 0 && !selectedWardView) {
          loadWardDetails(data.wards[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load wards:', err);
    } finally {
      setIsLoadingWards(false);
    }
  };

  // Load single ward view details
  const loadWardDetails = async (relationshipId: string) => {
    setWardViewError(null);
    try {
      const res = await fetch(`/api/guardian/wards/${relationshipId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setSelectedWardView(data.wardView);
      } else {
        setWardViewError(data.message || 'Unable to view ward details.');
      }
    } catch (err: any) {
      setWardViewError(err.message || 'Error fetching ward details.');
    }
  };

  // Load notifications
  const loadNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    loadRelationships();
    loadWards();
    loadNotifications();
  }, []);

  // Handle invitation creation
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setIsSubmittingInvite(true);
    try {
      const res = await fetch('/api/guardian/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          guardianEmail,
          guardianName: guardianName || undefined,
          relationshipLabel,
          preferences: {
            shareActivityStatus: prefActivity,
            shareWellnessStreak: prefStreak,
            shareVoluntaryMood: prefMood,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreatedTokenResult({
          token: data.invitation.invitationToken,
          expiresAt: data.invitation.expiresAt,
        });
        loadRelationships();
        loadNotifications();
      } else {
        setInviteError(data.message || 'Failed to create invitation.');
      }
    } catch (err: any) {
      setInviteError(err.message || 'Network error creating invitation.');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  // Handle revoke relationship
  const handleRevokeRelationship = async (relationshipId: string) => {
    if (!window.confirm('Are you sure you want to revoke this guardian relationship? Their access will end immediately.')) {
      return;
    }
    try {
      const res = await fetch(`/api/guardian/relationships/${relationshipId}/revoke`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        loadRelationships();
        loadNotifications();
      }
    } catch (err) {
      console.error('Failed to revoke guardian:', err);
    }
  };

  // Handle disconnect guardian
  const handleDisconnect = async (relationshipId: string) => {
    if (!window.confirm('Are you sure you want to disconnect from this ward? You will no longer receive their updates.')) {
      return;
    }
    try {
      const res = await fetch(`/api/guardian/relationships/${relationshipId}/disconnect`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setSelectedWardView(null);
        loadWards();
        loadNotifications();
      }
    } catch (err) {
      console.error('Failed to disconnect guardian:', err);
    }
  };

  // Handle toggle sharing preference
  const handleTogglePreference = async (
    relationshipId: string,
    key: 'shareActivityStatus' | 'shareWellnessStreak' | 'shareVoluntaryMood',
    currentValue: boolean,
  ) => {
    try {
      const res = await fetch(`/api/guardian/relationships/${relationshipId}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [key]: !currentValue }),
      });
      const data = await res.json();
      if (data.success) {
        setRelationships((prev) =>
          prev.map((r) =>
            r.id === relationshipId
              ? { ...r, sharingPreferences: { ...r.sharingPreferences, ...data.preferences } }
              : r,
          ),
        );
      }
    } catch (err) {
      console.error('Failed to update preference:', err);
    }
  };

  // Handle voluntary mood check-in
  const handleMoodCheckIn = async (mood: string) => {
    setSelectedMood(mood);
    setMoodSuccessMessage(null);
    try {
      const res = await fetch('/api/wellness/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mood }),
      });
      const data = await res.json();
      if (data.success) {
        setMoodSuccessMessage(`Recorded mood: "${mood}". Shared only with guardians you authorized.`);
        setTimeout(() => setMoodSuccessMessage(null), 5000);
      }
    } catch (err) {
      console.error('Failed to submit mood check-in:', err);
    }
  };

  // Handle preview token
  const handlePreviewToken = async () => {
    if (!inputToken.trim()) return;
    setPreviewError(null);
    setPreviewData(null);
    setAcceptMessage(null);
    try {
      const res = await fetch(`/api/guardian/invitations/preview?token=${encodeURIComponent(inputToken.trim())}`);
      const data = await res.json();
      if (data.success) {
        setPreviewData(data.preview);
      } else {
        setPreviewError(data.message || 'Invalid or expired invitation token.');
      }
    } catch (err: any) {
      setPreviewError(err.message || 'Error checking invitation token.');
    }
  };

  // Handle accept invite
  const handleAcceptInvite = async () => {
    if (!inputToken.trim()) return;
    setIsAccepting(true);
    setAcceptMessage(null);
    setPreviewError(null);
    try {
      const res = await fetch('/api/guardian/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: inputToken.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setAcceptMessage('Success! You are now connected as a trusted guardian.');
        setInputToken('');
        setPreviewData(null);
        loadWards();
        loadNotifications();
      } else {
        setPreviewError(data.message || 'Failed to accept invitation.');
      }
    } catch (err: any) {
      setPreviewError(err.message || 'Network error accepting invitation.');
    } finally {
      setIsAccepting(false);
    }
  };

  // Handle decline invite
  const handleDeclineInvite = async () => {
    if (!inputToken.trim()) return;
    try {
      const res = await fetch('/api/guardian/invitations/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: inputToken.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setAcceptMessage('Invitation declined successfully.');
        setInputToken('');
        setPreviewData(null);
        loadNotifications();
      }
    } catch (err) {
      console.error('Failed to decline invitation:', err);
    }
  };

  // Copy token to clipboard
  const handleCopyToken = () => {
    if (createdTokenResult) {
      navigator.clipboard.writeText(createdTokenResult.token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 3000);
    }
  };

  return (
    <div id="guardian-system-container" className="space-y-6">
      {/* Header & Architecture Guarantee */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-800 font-semibold mb-1">
              <HeartHandshake className="h-5 w-5" />
              <span>Consent-Driven Guardian Network</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-stone-900">
              Trusted Human Connection & Zero-Surveillance Oversight
            </h2>
            <p className="mt-1 text-sm text-stone-600 max-w-2xl leading-relaxed">
              Connect voluntary trusted supporters to your wellness journey. You have full sovereign control over
              what is shared. Private conversations, voice recordings, and crisis response details are strictly locked
              and never accessible to guardians.
            </p>
          </div>

          <button
            onClick={() => {
              setCreatedTokenResult(null);
              setGuardianEmail('');
              setGuardianName('');
              setPrefActivity(false);
              setPrefStreak(false);
              setPrefMood(false);
              setShowInviteModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 transition shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            <span>Invite Trusted Guardian</span>
          </button>
        </div>

        {/* Privacy Guarantees Pill Bar */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-stone-100 text-xs">
          <div className="flex items-center gap-2 rounded-xl bg-stone-50 p-3 border border-stone-200/80">
            <Lock className="h-4 w-4 text-emerald-700 shrink-0" />
            <span className="text-stone-700 font-medium">Conversations & Transcripts 100% Private</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-stone-50 p-3 border border-stone-200/80">
            <Shield className="h-4 w-4 text-emerald-700 shrink-0" />
            <span className="text-stone-700 font-medium">No Crisis or Safety Telemetry Leaked</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-stone-50 p-3 border border-stone-200/80">
            <EyeOff className="h-4 w-4 text-emerald-700 shrink-0" />
            <span className="text-stone-700 font-medium">Opt-In Only: Revoke Access Anytime</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap border-b border-stone-200 gap-2">
        <button
          onClick={() => setSubTab('my-guardians')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            subTab === 'my-guardians'
              ? 'border-emerald-700 text-emerald-800 font-semibold'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>My Guardians ({relationships.filter((r) => r.status === 'ACTIVE').length})</span>
        </button>

        <button
          onClick={() => setSubTab('guardian-dashboard')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            subTab === 'guardian-dashboard'
              ? 'border-emerald-700 text-emerald-800 font-semibold'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Guardian Oversight Dashboard ({wards.length})</span>
        </button>

        <button
          onClick={() => setSubTab('accept-invite')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            subTab === 'accept-invite'
              ? 'border-emerald-700 text-emerald-800 font-semibold'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <HeartHandshake className="h-4 w-4" />
          <span>Accept Invitation</span>
        </button>

        <button
          onClick={() => setSubTab('notifications')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            subTab === 'notifications'
              ? 'border-emerald-700 text-emerald-800 font-semibold'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <Bell className="h-4 w-4" />
          <span>Notifications ({notifications.filter((n) => !n.isRead).length})</span>
        </button>
      </div>

      {/* SUBTAB 1: MY GUARDIANS */}
      {subTab === 'my-guardians' && (
        <div className="space-y-6">
          {/* Voluntary Mood Check-in Widget */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2 text-stone-900 font-semibold text-sm">
                <Smile className="h-4 w-4 text-emerald-700" />
                <span>Voluntary Daily Wellness Check-in</span>
              </div>
              <span className="text-xs text-stone-500">Non-Clinical • Sovereign • Strictly Opt-In</span>
            </div>
            <p className="text-xs text-stone-600 mb-4">
              Select how you feel today. If you have enabled &quot;Share Voluntary Mood&quot; for a guardian, they can see this simple tag. Your chats remain completely private.
            </p>

            <div className="flex flex-wrap gap-2">
              {['Calm & Grounded', 'Reflective', 'Hopeful', 'A Bit Stressed', 'Low Energy', 'Grateful'].map(
                (mood) => (
                  <button
                    key={mood}
                    onClick={() => handleMoodCheckIn(mood)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                      selectedMood === mood
                        ? 'border-emerald-700 bg-emerald-700 text-white shadow-xs'
                        : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-emerald-300 hover:bg-emerald-50/50'
                    }`}
                  >
                    {mood}
                  </button>
                ),
              )}
            </div>

            {moodSuccessMessage && (
              <div className="mt-3 text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{moodSuccessMessage}</span>
              </div>
            )}
          </div>

          {/* Connected Guardians List */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-stone-900">Configured Guardian Relationships</h3>
              <button
                onClick={loadRelationships}
                className="text-stone-500 hover:text-stone-800 transition p-1"
                title="Refresh relationships"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingRelationships ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {relationships.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-stone-200 rounded-xl">
                <Users className="h-8 w-8 text-stone-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-stone-700">No guardians connected yet</p>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  You can invite a trusted friend, family member, or partner to be your wellness guardian with full control over what is shared.
                </p>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite a Guardian
                </button>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {relationships.map((rel) => (
                  <div key={rel.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-stone-900">
                            {rel.guardianName || rel.guardianEmail}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                              rel.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : rel.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-stone-100 text-stone-600 border border-stone-200'
                            }`}
                          >
                            {rel.status}
                          </span>
                          {rel.relationshipLabel && (
                            <span className="text-xs text-stone-500 font-medium">({rel.relationshipLabel})</span>
                          )}
                        </div>
                        <div className="text-xs text-stone-500 mt-0.5">
                          <span>{rel.guardianEmail}</span>
                          <span className="mx-2">•</span>
                          <span>Created {new Date(rel.createdAt).toLocaleDateString()}</span>
                          {rel.invitationAcceptedAt && (
                            <>
                              <span className="mx-2">•</span>
                              <span>Connected {new Date(rel.invitationAcceptedAt).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {rel.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleRevokeRelationship(rel.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 transition self-start sm:self-center"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Revoke Access</span>
                        </button>
                      )}
                    </div>

                    {/* Granular Sharing Toggles (for active guardians) */}
                    {rel.status === 'ACTIVE' && (
                      <div className="mt-3 rounded-xl bg-stone-50 p-3 border border-stone-200/80">
                        <div className="text-[11px] font-semibold text-stone-700 uppercase tracking-wider mb-2">
                          Sovereign Sharing Preferences (Instant Revocation)
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rel.sharingPreferences.shareActivityStatus}
                              onChange={() =>
                                handleTogglePreference(
                                  rel.id,
                                  'shareActivityStatus',
                                  rel.sharingPreferences.shareActivityStatus,
                                )
                              }
                              className="rounded border-stone-300 text-emerald-700 focus:ring-emerald-700"
                            />
                            <span>Share Activity / Last Active</span>
                          </label>

                          <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rel.sharingPreferences.shareWellnessStreak}
                              onChange={() =>
                                handleTogglePreference(
                                  rel.id,
                                  'shareWellnessStreak',
                                  rel.sharingPreferences.shareWellnessStreak,
                                )
                              }
                              className="rounded border-stone-300 text-emerald-700 focus:ring-emerald-700"
                            />
                            <span>Share Wellness Streak Days</span>
                          </label>

                          <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rel.sharingPreferences.shareVoluntaryMood}
                              onChange={() =>
                                handleTogglePreference(
                                  rel.id,
                                  'shareVoluntaryMood',
                                  rel.sharingPreferences.shareVoluntaryMood,
                                )
                              }
                              className="rounded border-stone-300 text-emerald-700 focus:ring-emerald-700"
                            />
                            <span>Share Voluntary Mood</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: GUARDIAN OVERSIGHT DASHBOARD */}
      {subTab === 'guardian-dashboard' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-stone-900">Consented Wards</h3>
                <p className="text-xs text-stone-600">
                  Wards who have voluntarily designated you as their trusted guardian.
                </p>
              </div>
              <button
                onClick={loadWards}
                className="text-stone-500 hover:text-stone-800 transition p-1"
                title="Refresh wards"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingWards ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {wards.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-stone-200 rounded-xl">
                <HeartHandshake className="h-8 w-8 text-stone-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-stone-700">No active wards assigned to you</p>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  If someone invited you to be their guardian, use the &quot;Accept Invitation&quot; tab to connect using your secure token.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Wards selector list */}
                <div className="space-y-2 md:col-span-1 border-r border-stone-100 pr-0 md:pr-4">
                  {wards.map((ward) => (
                    <button
                      key={ward.id}
                      onClick={() => loadWardDetails(ward.id)}
                      className={`w-full text-left p-3 rounded-xl border transition ${
                        selectedWardView?.relationshipId === ward.id
                          ? 'border-emerald-700 bg-emerald-50/50 shadow-xs'
                          : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                      }`}
                    >
                      <div className="font-semibold text-stone-900 text-sm">{ward.userName || 'Ward'}</div>
                      <div className="text-xs text-stone-500 mt-0.5">{ward.relationshipLabel || 'Ward'}</div>
                      <div className="text-[11px] text-stone-400 mt-1">
                        Since {new Date(ward.invitationAcceptedAt || ward.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Selected Ward Privacy View */}
                <div className="md:col-span-2">
                  {wardViewError ? (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{wardViewError}</span>
                    </div>
                  ) : selectedWardView ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                        <div>
                          <h4 className="text-base font-bold text-stone-900">{selectedWardView.wardName}</h4>
                          <span className="text-xs text-stone-500">
                            Relationship: {selectedWardView.relationshipLabel || 'Trusted Contact'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDisconnect(selectedWardView.relationshipId)}
                          className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Disconnect</span>
                        </button>
                      </div>

                      {/* Zero Surveillance Transparency Notice */}
                      <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3 text-xs text-stone-600 flex items-start gap-2.5">
                        <Lock className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-stone-800">Zero-Surveillance Architecture:</span> Direct
                          conversation dialogues, voice audio transcripts, and clinical crisis flags are strictly
                          withheld to protect ward sovereignty and privacy.
                        </div>
                      </div>

                      {/* Permitted Wellness Signals */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        {/* 1. Activity Status */}
                        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
                          <div className="flex items-center gap-1.5 text-xs text-stone-500 font-semibold mb-2">
                            <Activity className="h-3.5 w-3.5 text-emerald-700" />
                            <span>Activity Status</span>
                          </div>
                          {selectedWardView.activityStatus ? (
                            <div>
                              <div className="text-sm font-bold text-stone-900">
                                {selectedWardView.activityStatus.checkedInToday ? 'Checked in Today' : 'Active Recently'}
                              </div>
                              <div className="text-[11px] text-stone-500 mt-1">
                                {selectedWardView.activityStatus.lastActiveAt
                                  ? new Date(selectedWardView.activityStatus.lastActiveAt).toLocaleString()
                                  : 'Not active recently'}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-stone-400 italic">Withheld by ward preference</div>
                          )}
                        </div>

                        {/* 2. Wellness Streak */}
                        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
                          <div className="flex items-center gap-1.5 text-xs text-stone-500 font-semibold mb-2">
                            <Flame className="h-3.5 w-3.5 text-amber-600" />
                            <span>Wellness Streak</span>
                          </div>
                          {selectedWardView.wellnessStreak ? (
                            <div>
                              <div className="text-2xl font-bold text-stone-900">
                                {selectedWardView.wellnessStreak.currentStreakDays}{' '}
                                <span className="text-xs font-medium text-stone-500">days</span>
                              </div>
                              <div className="text-[11px] text-stone-500 mt-1">Consistent check-ins</div>
                            </div>
                          ) : (
                            <div className="text-xs text-stone-400 italic">Withheld by ward preference</div>
                          )}
                        </div>

                        {/* 3. Voluntary Mood */}
                        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
                          <div className="flex items-center gap-1.5 text-xs text-stone-500 font-semibold mb-2">
                            <Smile className="h-3.5 w-3.5 text-emerald-700" />
                            <span>Voluntary Mood</span>
                          </div>
                          {selectedWardView.voluntaryMood ? (
                            <div>
                              <div className="text-sm font-bold text-stone-900">
                                {selectedWardView.voluntaryMood.recentMood || 'Unrecorded'}
                              </div>
                              <div className="text-[11px] text-stone-500 mt-1">
                                {selectedWardView.voluntaryMood.recordedAt
                                  ? new Date(selectedWardView.voluntaryMood.recordedAt).toLocaleDateString()
                                  : ''}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-stone-400 italic">Withheld by ward preference</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-stone-400 text-xs">Select a ward to view indicators</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: ACCEPT INVITATION */}
      {subTab === 'accept-invite' && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs max-w-xl mx-auto">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm mb-1">
            <HeartHandshake className="h-4 w-4" />
            <span>Connect as a Guardian</span>
          </div>
          <h3 className="text-lg font-bold text-stone-900">Accept Guardian Invitation</h3>
          <p className="text-xs text-stone-600 mt-1 mb-4 leading-relaxed">
            Enter the single-use invitation token provided by the person who invited you. Tokens are valid for 7 days
            and can only be accepted once.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Invitation Token</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  placeholder="e.g. niva_ginv_1a2b3c4d..."
                  className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-xs font-mono focus:border-emerald-700 focus:ring-emerald-700"
                />
                <button
                  type="button"
                  onClick={handlePreviewToken}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition"
                >
                  Verify
                </button>
              </div>
            </div>

            {previewError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{previewError}</span>
              </div>
            )}

            {acceptMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{acceptMessage}</span>
              </div>
            )}

            {previewData && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <div className="text-xs font-bold text-emerald-950">Valid Invitation Found</div>
                <div className="text-xs text-stone-700 space-y-1">
                  <div>
                    <span className="font-semibold text-stone-900">Invited By:</span> {previewData.inviterName}
                  </div>
                  <div>
                    <span className="font-semibold text-stone-900">Target Contact:</span> {previewData.guardianEmail}
                  </div>
                  <div>
                    <span className="font-semibold text-stone-900">Relationship:</span>{' '}
                    {previewData.relationshipLabel || 'Trusted Contact'}
                  </div>
                  <div>
                    <span className="font-semibold text-stone-900">Expires:</span>{' '}
                    {new Date(previewData.expiresAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isAccepting}
                    onClick={handleAcceptInvite}
                    className="flex-1 rounded-lg bg-emerald-700 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition"
                  >
                    {isAccepting ? 'Connecting...' : 'Accept & Connect as Guardian'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeclineInvite}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 4: NOTIFICATIONS */}
      {subTab === 'notifications' && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-stone-900">In-App Guardian Notifications</h3>
            <button
              onClick={loadNotifications}
              className="text-stone-500 hover:text-stone-800 transition p-1"
              title="Refresh notifications"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-xs">No notifications yet.</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {notifications.map((notif) => (
                <div key={notif.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-1.5 rounded-lg mt-0.5 ${
                        notif.type.includes('ACCEPTED')
                          ? 'bg-emerald-100 text-emerald-800'
                          : notif.type.includes('REVOKED') || notif.type.includes('DECLINED')
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      <Bell className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-stone-900">{notif.title}</div>
                      <div className="text-xs text-stone-600 mt-0.5">{notif.message}</div>
                      <div className="text-[10px] text-stone-400 mt-1">
                        {new Date(notif.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* INVITE GUARDIAN MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                <UserPlus className="h-4 w-4" />
                <span>Invite Trusted Guardian</span>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-stone-400 hover:text-stone-600 transition"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {createdTokenResult ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs text-emerald-950">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-900 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    <span>Invitation Created Successfully!</span>
                  </div>
                  <span>
                    Share the invitation token below with your trusted guardian. It is single-use and valid for 7 days.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Single-Use Token</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdTokenResult.token}
                      className="flex-1 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-mono text-stone-800"
                    />
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition"
                    >
                      {copiedToken ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Expires: {new Date(createdTokenResult.expiresAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="w-full rounded-xl bg-stone-900 py-2.5 text-xs font-semibold text-white hover:bg-black transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Guardian Email Address <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={guardianEmail}
                    onChange={(e) => setGuardianEmail(e.target.value)}
                    placeholder="trusted.friend@example.com"
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs focus:border-emerald-700 focus:ring-emerald-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Guardian Name (Optional)</label>
                    <input
                      type="text"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="e.g. Sarah"
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs focus:border-emerald-700 focus:ring-emerald-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Relationship</label>
                    <select
                      value={relationshipLabel}
                      onChange={(e) => setRelationshipLabel(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs focus:border-emerald-700 focus:ring-emerald-700"
                    >
                      <option value="Friend">Friend</option>
                      <option value="Family">Family Member</option>
                      <option value="Partner">Partner / Spouse</option>
                      <option value="Mentor">Mentor / Guide</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Granular Sharing Defaults */}
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-2">
                  <div className="text-xs font-bold text-stone-800">Initial Sharing Permissions (Opt-In)</div>
                  <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefActivity}
                      onChange={(e) => setPrefActivity(e.target.checked)}
                      className="rounded border-stone-300 text-emerald-700 focus:ring-emerald-700"
                    />
                    <span>Share general activity status / last active</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefStreak}
                      onChange={(e) => setPrefStreak(e.target.checked)}
                      className="rounded border-stone-300 text-emerald-700 focus:ring-emerald-700"
                    />
                    <span>Share wellness check-in streak count</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefMood}
                      onChange={(e) => setPrefMood(e.target.checked)}
                      className="rounded border-stone-300 text-emerald-700 focus:ring-emerald-700"
                    />
                    <span>Share voluntary mood check-ins</span>
                  </label>
                </div>

                {inviteError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{inviteError}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingInvite}
                    className="flex-1 rounded-xl bg-emerald-700 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 transition"
                  >
                    {isSubmittingInvite ? 'Generating Invitation...' : 'Create Invitation Link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="rounded-xl border border-stone-300 px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
