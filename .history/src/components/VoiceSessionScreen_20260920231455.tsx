/**
 * NIVA Dedicated Realtime Voice Experience Component
 * Private, secure voice companion experience powered by Google Gemini Live.
 *
 * Core Features:
 * - Dedicated immersive visual presence (Calm ambient breathing orb)
 * - Microphone capture with client-side linear resampling to 16kHz PCM
 * - Realtime bidirectional WebSocket relay (/live) using ephemeral voice ticket
 * - Strict canonical VoiceConnectionState: DISCONNECTED, REQUESTING_MIC, CONNECTING, LISTENING, SPEAKING, MUTED, ENDED, ERROR
 * - Native audio playback @ 24kHz with genuine instant barge-in interruption
 * - Microphone mute / unmute toggle
 * - Manual interrupt button & speech barge-in detection
 * - Direct association with user's wellness session
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  AlertCircle,
  Hand,
  Shield,
  Radio,
  Clock,
  HeartHandshake,
} from 'lucide-react';
import {
  VoiceConnectionState,
  VoiceTicketResponseDto,
  ClientVoiceMessage,
  ServerVoiceMessage,
} from '@shared/types/voice';
import { floatTo16BitPCMBase64, base64PCMToAudioBuffer, resampleTo16kHz } from '../utils/audio-pcm';

interface VoiceSessionScreenProps {
  conversationId: string;
  conversationTitle: string;
  onClose: () => void;
  onEndSession?: () => void;
  onOpenCrisisResources?: () => void;
}

export const VoiceSessionScreen: React.FC<VoiceSessionScreenProps> = ({
  conversationId,
  conversationTitle,
  onClose,
  onEndSession,
  onOpenCrisisResources,
}) => {
  const [connectionState, setConnectionState] = useState<VoiceConnectionState>('DISCONNECTED');
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [interruptionCount, setInterruptionCount] = useState(0);
  const [micAudioLevel, setMicAudioLevel] = useState(0);

  // Audio Context & Stream Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const scheduledAudioSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlaybackTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<any>(null);
  const isMutedRef = useRef(false);
  const connectionStateRef = useRef<VoiceConnectionState>('DISCONNECTED');
  const lastInterruptionTimeRef = useRef<number>(0);

  isMutedRef.current = isMuted;
  connectionStateRef.current = connectionState;

  // Stop current audio playback queue immediately (barge-in / interruption)
  const stopAudioPlayback = useCallback(() => {
    scheduledAudioSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch (err) {
        // ignore already stopped sources
      }
    });
    scheduledAudioSourcesRef.current = [];
    if (audioContextRef.current) {
      nextPlaybackTimeRef.current = audioContextRef.current.currentTime;
    }
  }, []);

  // Centralized interruption handler with debounced counting and server notification
  const triggerInterruption = useCallback((sendToServer = true) => {
    stopAudioPlayback();
    if (connectionStateRef.current !== 'MUTED' && connectionStateRef.current !== 'ENDED') {
      setConnectionState('LISTENING');
    }

    const now = Date.now();
    if (now - lastInterruptionTimeRef.current > 1500) {
      lastInterruptionTimeRef.current = now;
      setInterruptionCount((c) => c + 1);
    }

    if (sendToServer && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'INTERRUPT' } as ClientVoiceMessage));
      } catch (err) {}
    }
  }, [stopAudioPlayback]);

  // Cleanup all audio resources & WebSockets
  const cleanupVoiceSession = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    stopAudioPlayback();

    if (processorNodeRef.current) {
      try {
        processorNodeRef.current.disconnect();
      } catch (e) {}
      processorNodeRef.current = null;
    }

    if (micSourceNodeRef.current) {
      try {
        micSourceNodeRef.current.disconnect();
      } catch (e) {}
      micSourceNodeRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'END_SESSION' } as ClientVoiceMessage));
          wsRef.current.close();
        }
      } catch (e) {}
      wsRef.current = null;
    }
  }, [stopAudioPlayback]);

  // Connect and start voice session
  const startVoiceSession = async () => {
    setErrorMessage(null);
    setConnectionState('REQUESTING_MIC');

    try {
      // 1. Request microphone permission
      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        micStreamRef.current = micStream;
      } catch (micErr: any) {
        console.error('Microphone permission denied or unavailable:', micErr);
        setErrorMessage('Microphone access is required for NIVA voice sessions. Please allow microphone permissions.');
        setConnectionState('ERROR');
        return;
      }

      setConnectionState('CONNECTING');

      // 2. Obtain short-lived single-use voice ticket from backend (authenticated session)
      const ticketRes = await fetch(`/api/conversations/${conversationId}/voice-ticket`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!ticketRes.ok) {
        const errorData = await ticketRes.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to authenticate voice session');
      }

      const ticketData: VoiceTicketResponseDto = await ticketRes.json();

      // 3. Setup Web Audio Context
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      nextPlaybackTimeRef.current = audioCtx.currentTime;

      // 4. Establish WebSocket connection to backend /live
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live?ticket=${encodeURIComponent(ticketData.ticket)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Connected to relay, start in LISTENING state
        setConnectionState('LISTENING');

        // Start duration timer
        timerIntervalRef.current = setInterval(() => {
          setDurationSeconds((sec) => sec + 1);
        }, 1000);

        // Setup microphone capture processor
        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSourceNodeRef.current = micSource;

        // Use ScriptProcessorNode (bufferSize 4096) for streaming audio chunks
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorNodeRef.current = processor;

        processor.onaudioprocess = (e) => {
          // Zero out output buffer to avoid echoing microphone input to speakers
          const outputBuffer = e.outputBuffer.getChannelData(0);
          outputBuffer.fill(0);

          if (isMutedRef.current || ws.readyState !== WebSocket.OPEN) {
            setMicAudioLevel(0);
            return;
          }

          const rawInputData = e.inputBuffer.getChannelData(0);

          // Calculate visual RMS audio level for feedback
          let sumSquares = 0;
          for (let i = 0; i < rawInputData.length; i++) {
            sumSquares += rawInputData[i] * rawInputData[i];
          }
          const rms = Math.sqrt(sumSquares / rawInputData.length);
          setMicAudioLevel(Math.min(1, rms * 4));

          // Genuine Barge-In: If user speaks above threshold while NIVA is speaking, interrupt immediately
          if (rms > 0.04 && connectionStateRef.current === 'SPEAKING') {
            triggerInterruption(true);
          }

          // Resample from hardware rate (e.g. 44.1kHz or 48kHz) to Gemini Live required 16,000 Hz
          const resampled16k = resampleTo16kHz(rawInputData, audioCtx.sampleRate, 16000);
          const base64Pcm = floatTo16BitPCMBase64(resampled16k);

          try {
            ws.send(
              JSON.stringify({
                type: 'AUDIO_CHUNK',
                audio: base64Pcm,
              } as ClientVoiceMessage),
            );
          } catch (err) {}
        };

        const silentGain = audioCtx.createGain();
        silentGain.gain.value = 0;
        micSource.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(audioCtx.destination);
      };

      ws.onmessage = async (event) => {
        try {
          const msg: ServerVoiceMessage = JSON.parse(event.data);

          if (msg.type === 'CONNECTED') {
            setConnectionState('LISTENING');
          } else if (msg.type === 'AUDIO_CHUNK') {
            // Discard stale in-flight audio chunks if interrupted recently
            if (Date.now() - lastInterruptionTimeRef.current < 600) {
              return;
            }

            if (connectionStateRef.current !== 'MUTED') {
              setConnectionState('SPEAKING');
            }

            if (audioContextRef.current && msg.audio) {
              const audioBuffer = base64PCMToAudioBuffer(msg.audio, audioContextRef.current, 24000);
              const source = audioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContextRef.current.destination);

              const now = audioContextRef.current.currentTime;
              const startTime = Math.max(now, nextPlaybackTimeRef.current);
              source.start(startTime);
              nextPlaybackTimeRef.current = startTime + audioBuffer.duration;

              scheduledAudioSourcesRef.current.push(source);

              source.onended = () => {
                const index = scheduledAudioSourcesRef.current.indexOf(source);
                if (index > -1) {
                  scheduledAudioSourcesRef.current.splice(index, 1);
                }
                if (scheduledAudioSourcesRef.current.length === 0) {
                  if (connectionStateRef.current !== 'MUTED' && connectionStateRef.current !== 'ENDED') {
                    setConnectionState('LISTENING');
                  }
                }
              };
            }
          } else if (msg.type === 'INTERRUPTED') {
            // Server confirmed model output interrupted
            triggerInterruption(false);
          } else if (msg.type === 'TURN_COMPLETE') {
            if (scheduledAudioSourcesRef.current.length === 0) {
              if (connectionStateRef.current !== 'MUTED') {
                setConnectionState('LISTENING');
              }
            }
          } else if (msg.type === 'ERROR') {
            setErrorMessage(msg.message);
            if (msg.fatal) {
              setConnectionState('ERROR');
              cleanupVoiceSession();
            }
          } else if (msg.type === 'SESSION_ENDED') {
            setConnectionState('ENDED');
            cleanupVoiceSession();
          }
        } catch (parseErr) {
          console.error('Error handling WebSocket message:', parseErr);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket connection error:', err);
        setErrorMessage("I couldn't connect to NIVA's voice session. Realtime service is not configured or reachable.");
        setConnectionState('ERROR');
        cleanupVoiceSession();
      };

      ws.onclose = () => {
        if (connectionStateRef.current !== 'ENDED' && connectionStateRef.current !== 'ERROR') {
          setConnectionState('ENDED');
        }
        cleanupVoiceSession();
      };
    } catch (err: any) {
      console.error('Failed to start voice session:', err);
      setErrorMessage(err.message || 'Failed to initialize voice session');
      setConnectionState('ERROR');
      cleanupVoiceSession();
    }
  };

  useEffect(() => {
    startVoiceSession();
    return () => {
      cleanupVoiceSession();
    };
  }, []);

  const handleManualInterrupt = () => {
    triggerInterruption(true);
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'MUTE', muted: nextMuted } as ClientVoiceMessage));
      }
      if (nextMuted) {
        setConnectionState('MUTED');
      } else {
        setConnectionState('LISTENING');
      }
      return nextMuted;
    });
  };

  const handleEndSession = () => {
    cleanupVoiceSession();
    setConnectionState('ENDED');
    if (onEndSession) {
      onEndSession();
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      id="niva-voice-experience-overlay"
      className="fixed inset-0 z-50 flex flex-col bg-radial from-stone-900 via-stone-950 to-black text-white selection:bg-emerald-900"
    >
      {/* Top Header Bar */}
      <header className="flex items-center justify-between border-b border-stone-800/80 bg-stone-900/60 backdrop-blur-md px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/30 text-emerald-400 border border-emerald-500/40">
            <Radio className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-stone-100">NIVA Voice</h1>
              <span className="rounded-md border border-emerald-500/40 bg-emerald-950/60 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                Private voice companion
              </span>
            </div>
            <p className="text-xs text-stone-400 truncate max-w-xs sm:max-w-md">
              Session: {conversationTitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onOpenCrisisResources && (
            <button
              onClick={onOpenCrisisResources}
              aria-label="Open Crisis Resources"
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/60 transition"
            >
              <HeartHandshake className="h-3.5 w-3.5 text-rose-400" />
              <span>Crisis Resources</span>
            </button>
          )}

          <div className="flex items-center gap-2 rounded-full border border-stone-800 bg-stone-900/80 px-3.5 py-1.5 text-xs text-stone-300">
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-mono">{formatTime(durationSeconds)}</span>
          </div>

          <button
            onClick={() => {
              cleanupVoiceSession();
              onClose();
            }}
            className="rounded-xl border border-stone-800 bg-stone-900/80 px-3 py-1.5 text-xs text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            Close View
          </button>
        </div>
      </header>

      {/* Main Visual Presence & Animated Voice Orb */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden">
        {/* Ambient background glow ring */}
        <div
          className={`absolute w-96 h-96 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
            connectionState === 'SPEAKING'
              ? 'bg-emerald-500/20 scale-125'
              : connectionState === 'LISTENING'
              ? 'bg-teal-500/15 scale-100'
              : connectionState === 'MUTED'
              ? 'bg-amber-500/10 scale-90'
              : 'bg-stone-700/10 scale-90'
          }`}
        />

        {/* Central Organic Audio Orb */}
        <div className="relative flex items-center justify-center my-8">
          {/* Animated concentric ripples during speaking */}
          {connectionState === 'SPEAKING' && (
            <>
              <div className="absolute h-48 w-48 rounded-full border border-emerald-500/40 animate-ping opacity-30 pointer-events-none" />
              <div className="absolute h-60 w-60 rounded-full border border-emerald-400/20 animate-pulse opacity-40 pointer-events-none" />
            </>
          )}

          {/* Microphone reactive ring during listening */}
          {connectionState === 'LISTENING' && micAudioLevel > 0.05 && (
            <div
              className="absolute rounded-full border border-teal-400/40 pointer-events-none transition-all duration-75"
              style={{
                width: `${160 + micAudioLevel * 80}px`,
                height: `${160 + micAudioLevel * 80}px`,
              }}
            />
          )}

          {/* Core Orb Container */}
          <div
            className={`relative flex h-36 w-36 sm:h-44 sm:w-44 items-center justify-center rounded-full shadow-2xl transition-all duration-500 ${
              connectionState === 'SPEAKING'
                ? 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 shadow-emerald-500/30 scale-105'
                : connectionState === 'LISTENING'
                ? 'bg-gradient-to-tr from-teal-700 via-emerald-700 to-stone-800 shadow-teal-500/20'
                : connectionState === 'MUTED'
                ? 'bg-gradient-to-tr from-stone-800 to-amber-950 border border-amber-700/40'
                : connectionState === 'CONNECTING' || connectionState === 'REQUESTING_MIC'
                ? 'bg-gradient-to-tr from-stone-800 to-stone-700 animate-pulse'
                : 'bg-stone-800 border border-stone-700'
            }`}
          >
            {connectionState === 'SPEAKING' ? (
              <Volume2 className="h-14 w-14 text-white animate-pulse" />
            ) : connectionState === 'LISTENING' ? (
              <Mic className="h-14 w-14 text-teal-200 animate-pulse" />
            ) : connectionState === 'MUTED' ? (
              <MicOff className="h-12 w-12 text-amber-300" />
            ) : (
              <Radio className="h-12 w-12 text-stone-400 animate-pulse" />
            )}
          </div>
        </div>

        {/* State Label & Guidance */}
        <div className="space-y-2 max-w-md mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-stone-800 bg-stone-900/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider">
            <span
              className={`h-2 w-2 rounded-full ${
                connectionState === 'SPEAKING'
                  ? 'bg-emerald-400 animate-pulse'
                  : connectionState === 'LISTENING'
                  ? 'bg-teal-400 animate-ping'
                  : connectionState === 'MUTED'
                  ? 'bg-amber-400'
                  : connectionState === 'CONNECTING' || connectionState === 'REQUESTING_MIC'
                  ? 'bg-blue-400 animate-spin'
                  : 'bg-stone-500'
              }`}
            />
            <span className="text-stone-200">
              {connectionState === 'DISCONNECTED' && 'Ready to Connect'}
              {connectionState === 'REQUESTING_MIC' && 'Requesting Microphone...'}
              {connectionState === 'CONNECTING' && 'Connecting to NIVA...'}
              {connectionState === 'LISTENING' && 'Listening...'}
              {connectionState === 'SPEAKING' && 'NIVA is Speaking'}
              {connectionState === 'MUTED' && 'Microphone Muted'}
              {connectionState === 'ENDED' && 'Voice Session Ended'}
              {connectionState === 'ERROR' && 'Connection Issue'}
            </span>
          </div>

          <p className="text-sm text-stone-400 leading-relaxed">
            {connectionState === 'LISTENING' && 'Speak naturally. You can interrupt NIVA anytime while it talks.'}
            {connectionState === 'MUTED' && 'Unmute your microphone when you are ready to speak.'}
            {connectionState === 'SPEAKING' && 'NIVA is responding warmly. Just speak to naturally interrupt.'}
            {connectionState === 'REQUESTING_MIC' && 'Please allow microphone access in your browser prompt.'}
            {connectionState === 'CONNECTING' && 'Setting up a secure voice session...'}
            {connectionState === 'ENDED' && 'Your voice conversation is preserved in your wellness session.'}
            {connectionState === 'ERROR' && 'Unable to establish realtime voice connection.'}
          </p>

          {interruptionCount > 0 && (
            <div className="text-[11px] text-stone-500 font-medium">
              Natural interruptions: {interruptionCount}
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-200 flex items-center justify-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </main>

      {/* Central Control Bar */}
      <footer className="border-t border-stone-800/80 bg-stone-900/80 backdrop-blur-md px-6 py-5">
        <div className="mx-auto max-w-xl flex items-center justify-center gap-6">
          {/* Mute/Unmute Toggle */}
          <button
            onClick={handleToggleMute}
            disabled={connectionState === 'ENDED' || connectionState === 'CONNECTING' || connectionState === 'REQUESTING_MIC'}
            className={`flex flex-col items-center gap-1.5 p-3.5 rounded-2xl border transition-all ${
              connectionState === 'MUTED'
                ? 'border-amber-500/50 bg-amber-950/40 text-amber-300 hover:bg-amber-950/60'
                : 'border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700'
            }`}
            title={connectionState === 'MUTED' ? 'Unmute microphone' : 'Mute microphone'}
          >
            {connectionState === 'MUTED' ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            <span className="text-[11px] font-medium">{connectionState === 'MUTED' ? 'Unmute' : 'Mute'}</span>
          </button>

          {/* Central Interrupt / Barge-In Button */}
          <button
            onClick={handleManualInterrupt}
            disabled={connectionState !== 'SPEAKING'}
            className={`flex flex-col items-center gap-1.5 px-6 py-3.5 rounded-2xl border transition-all ${
              connectionState === 'SPEAKING'
                ? 'border-emerald-400 bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-500 active:scale-95'
                : 'border-stone-800 bg-stone-900/60 text-stone-500 cursor-not-allowed'
            }`}
            title="Interrupt NIVA and speak"
          >
            <Hand className="h-6 w-6" />
            <span className="text-[11px] font-medium">Interrupt NIVA</span>
          </button>

          {/* End Voice Session Button */}
          <button
            onClick={handleEndSession}
            className="flex flex-col items-center gap-1.5 p-3.5 rounded-2xl border border-red-500/40 bg-red-950/40 text-red-300 hover:bg-red-900/50 transition-all active:scale-95"
            title="End voice session"
          >
            <PhoneOff className="h-6 w-6" />
            <span className="text-[11px] font-medium">End Voice</span>
          </button>
        </div>

        {/* Ethical Voice & Safety Boundary Disclaimer */}
        <div className="mt-4 text-center text-[11px] text-stone-400 max-w-xl mx-auto flex items-center justify-center gap-1.5 leading-relaxed">
          <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
          <span>
            AI-powered live audio is not monitored in real time by healthcare professionals. If in acute crisis or danger, tap Crisis Resources or call your local emergency services.
          </span>
        </div>
      </footer>
    </div>
  );
};
