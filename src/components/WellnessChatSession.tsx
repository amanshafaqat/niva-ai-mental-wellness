import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Plus,
  Send,
  StopCircle,
  Clock,
  Settings,
  Sparkles,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  Shield,
  Heart,
  Volume2,
  Mic,
} from 'lucide-react';
import {
  ConversationSummaryDto,
  ConversationDetailDto,
  ConversationMessageDto,
  UserPreferencesDto,
  ResponseStyle,
  ConversationPreference,
} from '@shared/types/conversation';
import { VoiceSessionScreen } from './VoiceSessionScreen';

export const WellnessChatSession: React.FC = () => {
  const [conversations, setConversations] = useState<ConversationSummaryDto[]>([]);
  const [activeSession, setActiveSession] = useState<ConversationDetailDto | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferencesDto>({
    responseStyle: 'SHORT',
    conversationPreference: 'LISTEN_AND_RESPOND',
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSavedToast, setPrefsSavedToast] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, loading]);

  // Load user sessions and preferences on mount
  useEffect(() => {
    loadSessionsAndPrefs();
  }, []);

  const loadSessionsAndPrefs = async () => {
    setInitialLoading(true);
    setError(null);
    try {
      const [convRes, prefsRes] = await Promise.all([
        fetch('/api/conversations', { credentials: 'include' }),
        fetch('/api/conversations/preferences', { credentials: 'include' }),
      ]);

      if (convRes.ok) {
        const convData: ConversationSummaryDto[] = await convRes.json();
        setConversations(convData);

        // Auto-select active or most recent session if available
        if (convData.length > 0) {
          const firstActive = convData.find((c) => c.status === 'ACTIVE') || convData[0];
          await loadSingleConversation(firstActive.id);
        }
      }

      if (prefsRes.ok) {
        const prefsData: UserPreferencesDto = await prefsRes.json();
        setPreferences(prefsData);
      }
    } catch (err: any) {
      console.error('Failed to load sessions:', err);
      setError('Could not load your wellness sessions. Please check your connection.');
    } finally {
      setInitialLoading(false);
    }
  };

  const loadSingleConversation = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${id}`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to load session');
      }
      const data: ConversationDetailDto = await res.json();
      setActiveSession(data);
    } catch (err: any) {
      setError(err.message || 'Error opening session');
    } finally {
      setLoading(false);
    }
  };

  const startNewSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const title = `Session ${new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`;

      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title }),
      });

      if (!res.ok) throw new Error('Failed to start new session');
      const newConv: ConversationSummaryDto = await res.json();

      // Refresh list and open new session
      const listRes = await fetch('/api/conversations', { credentials: 'include' });
      if (listRes.ok) {
        const updatedList = await listRes.json();
        setConversations(updatedList);
      }

      await loadSingleConversation(newConv.id);
    } catch (err: any) {
      setError(err.message || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeSession || loading) return;

    const text = inputText.trim();
    setInputText('');
    setError(null);

    // Optimistically show user message
    const tempUserMsg: ConversationMessageDto = {
      id: `temp-${Date.now()}`,
      conversationId: activeSession.id,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    setActiveSession((prev) =>
      prev ? { ...prev, messages: [...prev.messages, tempUserMsg] } : prev,
    );
    setLoading(true);

    try {
      const res = await fetch(`/api/conversations/${activeSession.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: text }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'NIVA could not respond right now.');
      }

      const data = await res.json();
      // Replace optimistic message and append real assistant message
      setActiveSession((prev) => {
        if (!prev) return prev;
        const filtered = prev.messages.filter((m) => m.id !== tempUserMsg.id);
        return {
          ...prev,
          messages: [...filtered, data.userMessage, data.assistantMessage],
        };
      });

      // Update snippet in list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeSession.id
            ? {
                ...c,
                messageCount: (c.messageCount || 0) + 2,
                lastMessageSnippet: data.assistantMessage.content.slice(0, 80),
              }
            : c,
        ),
      );
    } catch (err: any) {
      setError(err.message || 'Could not send message. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const endCurrentSession = async () => {
    if (!activeSession || activeSession.status === 'ENDED') return;

    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${activeSession.id}/end`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to end session');

      setActiveSession((prev) => (prev ? { ...prev, status: 'ENDED', endedAt: new Date().toISOString() } : prev));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeSession.id
            ? { ...c, status: 'ENDED', endedAt: new Date().toISOString() }
            : c,
        ),
      );
    } catch (err: any) {
      setError(err.message || 'Failed to end session');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSavingPrefs(true);
    try {
      const res = await fetch('/api/conversations/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(preferences),
      });
      if (res.ok) {
        setPrefsSavedToast(true);
        setTimeout(() => setPrefsSavedToast(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div id="wellness-chat-engine" className="space-y-6">
      {/* Session Management Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
            <Heart className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              {activeSession ? activeSession.title : 'Wellness Sessions'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-stone-600">
              <span className="flex items-center gap-1">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    activeSession?.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-stone-400'
                  }`}
                />
                {activeSession?.status === 'ACTIVE' ? 'Session In Progress' : 'Session Ended'}
              </span>
              <span>•</span>
              <span>NIVA AI (Gemini 3.8 Flash)</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {activeSession && activeSession.status === 'ACTIVE' && (
            <button
              id="start-voice-session-button"
              onClick={() => setShowVoiceOverlay(true)}
              disabled={loading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 transition shadow-xs"
              title="Start Realtime Voice-to-Voice Conversation with NIVA"
            >
              <Mic className="h-4 w-4" />
              <span>Voice Session</span>
            </button>
          )}

          <button
            id="start-new-session-button"
            onClick={startNewSession}
            disabled={loading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-900 transition disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>Start New Session</span>
          </button>

          {activeSession && activeSession.status === 'ACTIVE' && (
            <button
              id="end-session-button"
              onClick={endCurrentSession}
              disabled={loading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800 hover:bg-rose-100 transition"
              title="Conclude this active session calmly"
            >
              <StopCircle className="h-4 w-4" />
              <span>End Session</span>
            </button>
          )}

          <button
            onClick={() => setShowPreferences(!showPreferences)}
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition ${
              showPreferences
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
            }`}
            title="Adjust NIVA response length and conversational style"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Preferences</span>
          </button>
        </div>
      </div>

      {/* Response Preferences Drawer */}
      {showPreferences && (
        <div className="rounded-2xl border border-stone-200 bg-stone-50/90 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-800" />
              <span>NIVA Conversational Preferences</span>
            </h3>
            {prefsSavedToast && (
              <span className="text-xs font-medium text-emerald-800 flex items-center gap-1 bg-emerald-100 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-medium text-stone-800">Response Style (Length):</label>
              <div className="grid grid-cols-3 gap-2">
                {(['SHORT', 'BALANCED', 'DETAILED'] as ResponseStyle[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => setPreferences({ ...preferences, responseStyle: style })}
                    className={`p-2.5 rounded-xl border text-center transition font-medium ${
                      preferences.responseStyle === style
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-stone-500">
                Default is SHORT (1-2 sentences). NIVA listens more than it talks.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-stone-800">Conversation Mode:</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'JUST_LISTEN', label: 'Just Listen' },
                  { key: 'LISTEN_AND_RESPOND', label: 'Listen & Respond' },
                  { key: 'HELP_ME_SOLVE', label: 'Help Me Solve' },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() =>
                      setPreferences({
                        ...preferences,
                        conversationPreference: m.key as ConversationPreference,
                      })
                    }
                    className={`p-2.5 rounded-xl border text-center transition font-medium ${
                      preferences.conversationPreference === m.key
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-stone-500">
                Determines whether NIVA gently validates, asks a follow-up, or gives one grounding tip.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={savePreferences}
              disabled={savingPrefs}
              className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 transition"
            >
              {savingPrefs ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}

      {/* Main Chat Interface Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Session History List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-stone-500" />
              Your Session History
            </span>
            <span className="text-xs text-stone-500 font-mono">{conversations.length}</span>
          </div>

          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {conversations.length === 0 && !initialLoading && (
              <div className="rounded-xl border border-dashed border-stone-200 bg-white p-4 text-center text-xs text-stone-500">
                No past sessions yet. Click <strong>Start New Session</strong> to begin.
              </div>
            )}

            {conversations.map((c) => {
              const isSelected = activeSession?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => loadSingleConversation(c.id)}
                  className={`w-full text-left p-3 rounded-xl border transition flex items-start justify-between gap-2 ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          c.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-stone-400'
                        }`}
                      />
                      <span className="text-xs font-semibold text-stone-900 truncate">
                        {c.title}
                      </span>
                    </div>
                    {c.lastMessageSnippet && (
                      <p className="mt-1 text-[11px] text-stone-500 truncate">
                        {c.lastMessageSnippet}
                      </p>
                    )}
                    <span className="mt-1 block text-[10px] text-stone-400">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 mt-0.5 ${
                      isSelected ? 'text-emerald-700' : 'text-stone-300'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Conversation Stream & Input */}
        <div className="lg:col-span-3 rounded-2xl border border-stone-200 bg-white shadow-xs flex flex-col h-[580px]">
          {/* Active Chat Header */}
          <div className="border-b border-stone-100 p-4 flex items-center justify-between bg-stone-50/50 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-800 text-white font-semibold text-xs">
                N
              </div>
              <div>
                <span className="text-sm font-bold text-stone-900">NIVA Companion</span>
                <span className="block text-[11px] text-stone-500">
                  Private & zero-retention dialogue • Server-side Gemini 3.8 Flash
                </span>
              </div>
            </div>

            {activeSession && (
              <span
                className={`text-xs px-2.5 py-1 rounded-md font-medium border ${
                  activeSession.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-stone-100 text-stone-600 border-stone-200'
                }`}
              >
                {activeSession.status === 'ACTIVE' ? 'Active' : 'Ended'}
              </span>
            )}
          </div>

          {/* Dialogue Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {activeSession?.messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {!isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-900 text-xs font-bold">
                      N
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-sm leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-emerald-800 text-white rounded-br-xs'
                        : 'bg-stone-100 text-stone-800 rounded-bl-xs border border-stone-200/70'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div
                      className={`mt-1.5 text-[10px] ${
                        isUser ? 'text-emerald-200 text-right' : 'text-stone-400'
                      }`}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-900 text-xs font-bold animate-pulse">
                  N
                </div>
                <div className="rounded-2xl rounded-bl-xs bg-stone-100 border border-stone-200/70 p-4 text-xs text-stone-500 flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-700" />
                  <span>NIVA is reflecting and listening...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  onClick={() => sendMessage()}
                  className="underline hover:text-rose-950 font-semibold"
                >
                  Retry
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="border-t border-stone-200 p-4 bg-white rounded-b-2xl">
            {activeSession?.status === 'ENDED' ? (
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-center text-xs text-stone-600 flex items-center justify-center gap-2">
                <StopCircle className="h-4 w-4 text-stone-400" />
                <span>This session has concluded. You can review the messages anytime or</span>
                <button
                  onClick={startNewSession}
                  className="font-semibold text-emerald-800 underline hover:text-emerald-950"
                >
                  start a new session
                </button>
                .
              </div>
            ) : (
              <form onSubmit={sendMessage} className="flex items-center gap-2">
                <input
                  id="chat-message-input"
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Share what is on your mind... NIVA is here to listen."
                  disabled={loading || !activeSession}
                  className="flex-1 rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-900 placeholder:text-stone-600 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 transition disabled:opacity-50"
                />
                <button
                  id="chat-send-button"
                  type="submit"
                  disabled={!inputText.trim() || loading || !activeSession}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  aria-label="Send message to NIVA"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}

            <div className="mt-2 text-center">
              <span className="text-[11px] text-stone-400">
                NIVA is an AI mental-wellness companion and is not a licensed medical professional.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Realtime Voice Session Overlay Modal (Phase 4) */}
      {showVoiceOverlay && activeSession && (
        <VoiceSessionScreen
          conversationId={activeSession.id}
          conversationTitle={activeSession.title}
          onClose={() => setShowVoiceOverlay(false)}
          onEndSession={() => {
            endCurrentSession();
            setShowVoiceOverlay(false);
          }}
        />
      )}
    </div>
  );
};
