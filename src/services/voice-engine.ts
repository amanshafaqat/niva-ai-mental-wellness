/**
 * NIVA Realtime Voice Engine (Phase 4.1)
 * Bridge between Browser WebSockets and Gemini Live Native-Audio API
 * Model: gemini-3.8-live (Google's canonical realtime native-audio model)
 *
 * Adheres strictly to:
 * - Ephemeral cryptographically random voice ticket authentication
 * - Server-side only GEMINI_API_KEY protection
 * - Prisma VoiceSession as persistent source of truth with graceful offline resilience
 * - Genuine barge-in interruption and playback cancellation
 * - Realtime 16kHz PCM audio input and 24kHz PCM audio output
 * - Empathetic, calm, non-clinical, concise spoken conversational tone
 */

import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import * as crypto from 'crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { AuthSession } from '../../shared/types/auth';
import {
  VoiceSessionStatus,
  VoiceTicketResponseDto,
  ClientVoiceMessage,
  ServerVoiceMessage,
  VoiceUsageMetricsDto,
} from '../../shared/types/voice';
import {
  userPreferencesStore,
  buildNivaSystemPrompt,
  InMemoryConversation,
} from './conversation-engine';
import { getPrismaClient } from '../lib/prisma';

export interface InMemoryVoiceSession {
  id: string;
  userId: string;
  conversationId: string;
  status: VoiceSessionStatus;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  interruptionCount: number;
}

// In-Memory Voice Session & Ticket Stores (transient cache and database-offline fallback)
export const voiceSessionsStore = new Map<string, InMemoryVoiceSession>();
export const voiceTicketsStore = new Map<
  string,
  {
    ticket: string;
    userId: string;
    conversationId: string;
    voiceSessionId: string;
    expiresAt: number;
  }
>();

export const voiceUsageStore: VoiceUsageMetricsDto = {
  totalVoiceSessions: 0,
  activeVoiceSessions: 0,
  totalVoiceDurationSeconds: 0,
  totalInterruptions: 0,
  connectionFailures: 0,
};

// Rate limiting: max 10 new voice tickets per minute per user
const voiceTicketRateLimitStore = new Map<string, number[]>();
const TICKET_RATE_WINDOW_MS = 60 * 1000;
const MAX_VOICE_TICKETS_PER_MINUTE = 10;

export function checkVoiceTicketRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = voiceTicketRateLimitStore.get(userId) || [];
  const valid = timestamps.filter((t) => now - t < TICKET_RATE_WINDOW_MS);
  if (valid.length >= MAX_VOICE_TICKETS_PER_MINUTE) {
    return false;
  }
  valid.push(now);
  voiceTicketRateLimitStore.set(userId, valid);
  return true;
}

/**
 * Creates a cryptographically random short-lived ticket (60 seconds)
 * for the authenticated user to connect to the /live WebSocket.
 * Persists session record into Prisma VoiceSession database.
 */
export async function createVoiceTicket(
  user: AuthSession['user'],
  conversation: InMemoryConversation,
): Promise<VoiceTicketResponseDto> {
  const ticket = `vtkt_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  const voiceSessionId = `vsess_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const expiresAt = Date.now() + 60 * 1000; // 60 seconds validity
  const startedAt = new Date();

  const voiceSession: InMemoryVoiceSession = {
    id: voiceSessionId,
    userId: user.id,
    conversationId: conversation.id,
    status: 'INITIALIZING',
    startedAt: startedAt.toISOString(),
    endedAt: null,
    durationSeconds: 0,
    interruptionCount: 0,
  };

  // Cache in memory for quick lookups
  voiceSessionsStore.set(voiceSessionId, voiceSession);
  voiceTicketsStore.set(ticket, {
    ticket,
    userId: user.id,
    conversationId: conversation.id,
    voiceSessionId,
    expiresAt,
  });

  voiceUsageStore.totalVoiceSessions += 1;

  // Persist into Prisma database (persistent source of truth)
  try {
    const prisma = getPrismaClient();
    await prisma.voiceSession.create({
      data: {
        id: voiceSessionId,
        userId: user.id,
        conversationId: conversation.id,
        status: 'INITIALIZING',
        startedAt,
        durationSeconds: 0,
      },
    });
  } catch (dbErr) {
    // If database connection is not configured or offline, continue with session cache
    console.warn('VoiceSession database persistence deferred:', dbErr instanceof Error ? dbErr.message : dbErr);
  }

  return {
    ticket,
    conversationId: conversation.id,
    voiceSessionId,
    expiresAt,
    model: 'gemini-3.8-live',
    voiceName: 'Zephyr', // Calming, warm, natural vocal tone
  };
}

/**
 * Validates and consumes a voice ticket (one-time use, cryptographically verified)
 */
export function consumeVoiceTicket(ticketStr: string): {
  userId: string;
  conversationId: string;
  voiceSessionId: string;
} | null {
  const record = voiceTicketsStore.get(ticketStr);
  if (!record) return null;

  voiceTicketsStore.delete(ticketStr); // Invalidate immediately to prevent reuse
  if (Date.now() > record.expiresAt) {
    return null; // Expired
  }

  return {
    userId: record.userId,
    conversationId: record.conversationId,
    voiceSessionId: record.voiceSessionId,
  };
}

/**
 * Builds NIVA's dedicated Realtime Voice System Prompt.
 * Emphasizes natural spoken conversation, brevity (1-3 sentences), warm pauses,
 * and immediate stop upon barge-in/interruption.
 */
export function buildNivaVoiceSystemPrompt(userId: string): string {
  const prefs = userPreferencesStore.get(userId) || {
    responseStyle: 'SHORT',
    conversationPreference: 'LISTEN_AND_RESPOND',
    updatedAt: new Date().toISOString(),
    userId,
  };

  const basePrompt = buildNivaSystemPrompt(prefs);

  return [
    basePrompt,
    '',
    'VOICE-SPECIFIC DIRECTIVES (REALTIME NATIVE AUDIO via gemini-3.8-live):',
    '- You are speaking directly via high-fidelity native audio.',
    '- Use a warm, calm, soothing, empathetic vocal pacing with natural micro-pauses.',
    '- KEEP SPOKEN REPLIES CONCISE: Normally 1 to 3 short conversational sentences.',
    '- LISTEN MORE THAN YOU TALK: Give space for the person to express themselves.',
    '- NEVER MONOLOGUE. Do not recite long essays, lists, or clinical definitions.',
    '- Ask at most ONE gentle question to give space for the user to speak.',
    '- If interrupted, gracefully yield immediately to the user.',
    '- You are an AI wellness companion, not a medical or clinical professional.',
  ].join('\n');
}

/**
 * Attaches the WebSocket Server to the HTTP Server for /live endpoint
 */
export function setupVoiceWebSocketServer(wss: WebSocketServer) {
  wss.on('connection', async (clientWs: WebSocket, req: IncomingMessage) => {
    let voiceSessionId: string | null = null;
    let geminiLiveSession: any = null;
    let isCleanedUp = false;
    let lastInterruptionTime = 0;
    const sessionStartTime = Date.now();

    const registerInterruption = (sessObj: any) => {
      const now = Date.now();
      if (now - lastInterruptionTime > 1500) {
        lastInterruptionTime = now;
        if (sessObj) sessObj.interruptionCount += 1;
        voiceUsageStore.totalInterruptions += 1;
      }
    };

    const cleanup = async () => {
      if (isCleanedUp) return;
      isCleanedUp = true;

      const durationSeconds = Math.max(0, Math.floor((Date.now() - sessionStartTime) / 1000));

      if (voiceSessionId) {
        const sess = voiceSessionsStore.get(voiceSessionId);
        if (sess && sess.status !== 'ENDED' && sess.status !== 'FAILED') {
          sess.status = 'ENDED';
          sess.endedAt = new Date().toISOString();
          sess.durationSeconds = durationSeconds;
          voiceUsageStore.totalVoiceDurationSeconds += sess.durationSeconds;
          if (voiceUsageStore.activeVoiceSessions > 0) {
            voiceUsageStore.activeVoiceSessions -= 1;
          }

          // Update persistent Prisma VoiceSession
          try {
            const prisma = getPrismaClient();
            await prisma.voiceSession.update({
              where: { id: voiceSessionId },
              data: {
                status: 'ENDED',
                endedAt: new Date(),
                durationSeconds,
              },
            });
          } catch (dbErr) {
            // Graceful fallback
          }
        }
      }

      try {
        if (geminiLiveSession) {
          geminiLiveSession.close?.();
          geminiLiveSession = null;
        }
      } catch (err) {
        // ignore close errors
      }

      try {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close();
        }
      } catch (err) {
        // ignore
      }
    };

    try {
      // 1. Authenticate via ticket query parameter
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const ticketParam = url.searchParams.get('ticket');

      if (!ticketParam) {
        voiceUsageStore.connectionFailures += 1;
        clientWs.send(
          JSON.stringify({
            type: 'ERROR',
            message: 'Authentication required. Missing voice ticket.',
            fatal: true,
          } as ServerVoiceMessage),
        );
        clientWs.close(1008, 'Missing ticket');
        return;
      }

      const ticketAuth = consumeVoiceTicket(ticketParam);
      if (!ticketAuth) {
        voiceUsageStore.connectionFailures += 1;
        clientWs.send(
          JSON.stringify({
            type: 'ERROR',
            message: 'Invalid or expired voice ticket. Please start a new session.',
            fatal: true,
          } as ServerVoiceMessage),
        );
        clientWs.close(1008, 'Invalid or expired ticket');
        return;
      }

      voiceSessionId = ticketAuth.voiceSessionId;
      const sess = voiceSessionsStore.get(voiceSessionId);
      if (sess) {
        sess.status = 'ACTIVE';
        voiceUsageStore.activeVoiceSessions += 1;
      }

      // Update Prisma status to ACTIVE
      try {
        const prisma = getPrismaClient();
        await prisma.voiceSession.update({
          where: { id: voiceSessionId },
          data: { status: 'ACTIVE' },
        });
      } catch (dbErr) {}

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length === 0) {
        voiceUsageStore.connectionFailures += 1;
        if (voiceSessionId) {
          const s = voiceSessionsStore.get(voiceSessionId);
          if (s) s.status = 'FAILED';
          try {
            const prisma = getPrismaClient();
            await prisma.voiceSession.update({
              where: { id: voiceSessionId },
              data: { status: 'FAILED', endedAt: new Date() },
            });
          } catch (dbErr) {}
        }
        clientWs.send(
          JSON.stringify({
            type: 'ERROR',
            message: 'Realtime voice companion is unavailable because Gemini API credentials are not configured in the server environment. Please configure GEMINI_API_KEY in Settings.',
            fatal: true,
          } as ServerVoiceMessage),
        );
        await cleanup();
        return;
      }

      // 2. Initialize Gemini Live connection with gemini-3.8-live
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      const systemInstruction = buildNivaVoiceSystemPrompt(ticketAuth.userId);

      // Notify client we are connected
      clientWs.send(
        JSON.stringify({
          type: 'CONNECTED',
          voiceSessionId: ticketAuth.voiceSessionId,
          conversationId: ticketAuth.conversationId,
        } as ServerVoiceMessage),
      );

      try {
        geminiLiveSession = await ai.live.connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Zephyr',
                },
              },
            },
            systemInstruction,
          },
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              if (isCleanedUp || clientWs.readyState !== WebSocket.OPEN) return;

              // Check if interrupted by user speech
              if (message.serverContent?.interrupted) {
                registerInterruption(sess);
                clientWs.send(JSON.stringify({ type: 'INTERRUPTED' } as ServerVoiceMessage));
                return;
              }

              // Extract audio inlineData
              const modelParts = message.serverContent?.modelTurn?.parts;
              if (modelParts && modelParts.length > 0) {
                for (const part of modelParts) {
                  if (part.inlineData?.data) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'AUDIO_CHUNK',
                        audio: part.inlineData.data,
                      } as ServerVoiceMessage),
                    );
                  }
                }
              }

              // Check turn complete
              if (message.serverContent?.turnComplete) {
                clientWs.send(JSON.stringify({ type: 'TURN_COMPLETE' } as ServerVoiceMessage));
              }
            },
            onerror: (err: any) => {
              console.error('Gemini Live API callback error:', err?.message || err);
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(
                  JSON.stringify({
                    type: 'ERROR',
                    message: "I couldn't connect to NIVA's voice session. Please try again.",
                    fatal: false,
                  } as ServerVoiceMessage),
                );
              }
            },
            onclose: () => {
              cleanup();
            },
          },
        });
      } catch (connectErr: any) {
        console.error('Failed to establish Gemini Live connection:', connectErr?.message || connectErr);
        voiceUsageStore.connectionFailures += 1;
        if (voiceSessionId) {
          const s = voiceSessionsStore.get(voiceSessionId);
          if (s) s.status = 'FAILED';
          try {
            const prisma = getPrismaClient();
            await prisma.voiceSession.update({
              where: { id: voiceSessionId },
              data: { status: 'FAILED', endedAt: new Date() },
            });
          } catch (dbErr) {}
        }
        clientWs.send(
          JSON.stringify({
            type: 'ERROR',
            message: "I couldn't connect to NIVA's voice session. Realtime service is not configured or reachable.",
            fatal: true,
          } as ServerVoiceMessage),
        );
        await cleanup();
        return;
      }

      // 3. Handle incoming client messages
      clientWs.on('message', (rawData: any) => {
        if (isCleanedUp || !geminiLiveSession) return;

        try {
          const parsed = JSON.parse(rawData.toString()) as ClientVoiceMessage;

          if (parsed.type === 'AUDIO_CHUNK') {
            // Forward PCM 16kHz base64 audio to Gemini Live using official SDK contract
            geminiLiveSession.sendRealtimeInput({
              audio: {
                data: parsed.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
              media: [
                {
                  data: parsed.audio,
                  mimeType: 'audio/pcm;rate=16000',
                },
              ],
            });
          } else if (parsed.type === 'INTERRUPT') {
            // Client detected barge-in or tapped interrupt
            registerInterruption(sess);
            // Confirm interruption to client immediately
            clientWs.send(JSON.stringify({ type: 'INTERRUPTED' } as ServerVoiceMessage));
            // Cut model turn on Live API session via activity start
            try {
              geminiLiveSession.sendRealtimeInput({
                activityStart: {},
              });
            } catch (err) {}
          } else if (parsed.type === 'END_SESSION') {
            const duration = Math.max(0, Math.floor((Date.now() - sessionStartTime) / 1000));
            clientWs.send(
              JSON.stringify({
                type: 'SESSION_ENDED',
                durationSeconds: duration,
              } as ServerVoiceMessage),
            );
            cleanup();
          }
        } catch (err: any) {
          console.error('Error handling client voice message:', err?.message || err);
        }
      });

      clientWs.on('close', () => {
        cleanup();
      });

      clientWs.on('error', (err) => {
        console.error('Client WebSocket error:', err);
        cleanup();
      });
    } catch (err: any) {
      console.error('Unhandled voice session connection error:', err?.message || err);
      cleanup();
    }
  });
}

/**
 * Retrieves voice sessions for a user directly from Prisma (with fallback to memory)
 */
export async function getVoiceSessionsForUser(userId: string) {
  try {
    const prisma = getPrismaClient();
    const sessions = await prisma.voiceSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
    return sessions;
  } catch (dbErr) {
    return Array.from(voiceSessionsStore.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }
}
