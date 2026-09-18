/**
 * NIVA Conversation Engine & AI Provider Implementation
 * Server-side implementation supporting Gemini 3.8 Flash, local database conversations,
 * user preferences, context management, safety guardrails, and usage tracking.
 */

import { GoogleGenAI } from '@google/genai';
import {
  ConversationStatus,
  ResponseStyle,
  ConversationPreference,
  UserPreferencesDto,
  ConversationDetailDto,
  ConversationSummaryDto,
  UsageMetricsDto,
} from '../../shared/types/conversation';

export interface InMemoryMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface InMemoryConversation {
  id: string;
  userId: string;
  title: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  messages: InMemoryMessage[];
}

export interface InMemoryUserPreferences {
  userId: string;
  responseStyle: ResponseStyle;
  conversationPreference: ConversationPreference;
  updatedAt: string;
}

// In-Memory fallback stores (and primary cache)
export const conversationsStore = new Map<string, InMemoryConversation>();
export const userPreferencesStore = new Map<string, InMemoryUserPreferences>();
export const usageStore = {
  totalConversations: 0,
  totalMessages: 0,
  totalAiRequests: 0,
};

// User-level rate limiting: Map<userId, timestamp[]>
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_MESSAGES_PER_MINUTE = 20; // 20 requests/minute per user

export function checkUserRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = rateLimitStore.get(userId) || [];
  const validTimestamps = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_MESSAGES_PER_MINUTE) {
    rateLimitStore.set(userId, validTimestamps);
    return { allowed: false, remaining: 0 };
  }

  validTimestamps.push(now);
  rateLimitStore.set(userId, validTimestamps);
  return { allowed: true, remaining: MAX_MESSAGES_PER_MINUTE - validTimestamps.length };
}

/**
 * Basic Safety & Risk Evaluation Layer
 * Detects immediate high-risk content and produces supportive human-help guidance
 * without fabricating emergency hotlines.
 */
export function evaluateInputSafety(text: string): {
  isSafe: boolean;
  blockedResponse?: string;
} {
  const lower = text.toLowerCase();

  const severeHarmKeywords = [
    'how to kill myself',
    'how to commit suicide',
    'how to end my life',
    'instructions to hang myself',
    'ways to kill myself',
    'how to overdose',
    'how to cut my wrist',
    'how to make a bomb',
    'kill myself',
    'commit suicide',
    'end my life',
    'ending my life',
    'end it all',
    'give up on life',
    'hang myself',
    'slit my wrist',
    'want to die',
    'suicidal thoughts',
    'thinking of suicide',
  ];

  for (const phrase of severeHarmKeywords) {
    if (lower.includes(phrase)) {
      return {
        isSafe: false,
        blockedResponse:
          "I hear how much pain you are in right now, and I care about your safety. Because I am an AI wellness companion and cannot provide emergency or medical care, please reach out immediately to a trusted person, your local emergency services, or an international crisis lifeline in your area (such as findahelpline.com, or your local crisis helpline). You do not have to face this alone.",
      };
    }
  }

  return { isSafe: true };
}

/**
 * Builds the NIVA System Prompt adhering to User Preferences and strict listening rules.
 */
export function buildNivaSystemPrompt(prefs: UserPreferencesDto): string {
  let styleInstruction = 'Keep your response to 1 to 3 concise, warm sentences.';
  if (prefs.responseStyle === 'SHORT') {
    styleInstruction = 'Keep your response very brief: 1 to 2 short, calm sentences.';
  } else if (prefs.responseStyle === 'DETAILED') {
    styleInstruction = 'Provide a thoughtful, calm response of 3 to 5 sentences with space to reflect.';
  }

  let modeInstruction = 'Acknowledge warmly, show empathy, and ask ONE gentle follow-up question.';
  if (prefs.conversationPreference === 'JUST_LISTEN') {
    modeInstruction = 'Simply reflect and validate feelings with deep warmth and empathy. Do NOT push for solutions or ask intrusive questions. Let the user vent.';
  } else if (prefs.conversationPreference === 'HELP_ME_SOLVE') {
    modeInstruction = 'Acknowledge the feeling warmly, then offer ONE small, practical, grounding step or perspective.';
  }

  return [
    'You are NIVA, an AI mental-wellness companion. "Someone to talk to."',
    '',
    'PERSONALITY & ETHICAL MANDATE:',
    '- Warm, calm, empathetic, patient, non-judgmental, simple, and natural.',
    '- Suitable for people of all backgrounds, ages, and education levels.',
    '- You are NOT a psychiatrist, psychologist, therapist, doctor, or human.',
    '- You are NOT a medical professional. Never diagnose conditions or prescribe treatments/medications.',
    '',
    'CORE RULE: LISTEN MORE THAN YOU TALK.',
    '- ' + styleInstruction,
    '- ' + modeInstruction,
    '- Do NOT generate numbered lists, multi-paragraph guides, long essays, or unsolicited lectures.',
    '- Never manipulate the user into emotional dependency or claim NIVA is their sole support.',
    '- When a user shares a problem, acknowledge it, show empathy, offer one gentle thought or question, and stop.',
  ].join('\n');
}

/**
 * Dispatches conversational prompt to Gemini 3.8 Flash model
 */
export async function generateNivaReply(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  prefs: UserPreferencesDto,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server. AI conversational features are currently unavailable.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  const systemInstruction = buildNivaSystemPrompt(prefs);

  // Take the most recent 10 messages for context management
  const contextWindow = history.slice(-10);

  const contents = contextWindow.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content.trim() }],
  }));

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Hello NIVA' }] });
  }

  const maxTokens = prefs.responseStyle === 'DETAILED' ? 300 : 160;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.6,
        maxOutputTokens: maxTokens,
      },
    });

    const reply = response.text?.trim();
    if (!reply) {
      return "I'm listening closely. Would you like to tell me more about that?";
    }

    return reply;
  } catch (error: any) {
    console.error('Gemini API call failed:', error?.message || error);
    // Safe friendly fallback without exposing internal error or key details
    return "I'm having trouble responding right now. Please try again in a moment.";
  }
}
