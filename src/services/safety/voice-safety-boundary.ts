/**
 * NIVA Voice Safety Integration Boundary
 * Phase 5: Advanced Safety & Crisis Response System
 * 
 * ARCHITECTURAL SAFETY BOUNDARY DISCLOSURE:
 * In NIVA's Gemini Live duplex architecture, the browser captures raw linear 16kHz PCM audio
 * and streams it directly to the server, which pipes it into Google's Gemini Live session.
 * The model streams back raw 24kHz audio chunks.
 * 
 * Because this realtime pipeline operates directly on binary audio streams without
 * synchronous server-side speech-to-text semantic transcription in the hot audio path,
 * real-time server-side safety classification cannot reliably intercept spoken utterances
 * before audio is rendered.
 * 
 * SAFE INTEGRATION BOUNDARY:
 * 1. Model-Level Safety Prompting: A stringent clinical safety directive is injected into the
 *    Gemini Live session's system instruction, instructing Zephyr to de-escalate, express care,
 *    and direct callers to emergency services if crisis or self-harm is spoken.
 * 2. Transparent Safety Disclosure: The voice UI prominently informs users that voice sessions
 *    are AI-generated and not monitored by emergency personnel or clinicians.
 * 3. Immediate Access to Crisis Resources: A dedicated, persistent "Crisis Resources" action
 *    is embedded in the voice screen, enabling one-tap access to international verified help.
 * 4. Non-Interference: This boundary preserves audio performance, low-latency playback,
 *    native Web Audio streaming, and barge-in interruption without injecting artificial latency.
 */

export const VOICE_SAFETY_SYSTEM_INSTRUCTION = [
  'SAFETY & CRISIS GUARDRAIL FOR VOICE SESSIONS:',
  '- You are speaking directly to a user in real-time as NIVA, a supportive wellness companion.',
  '- You are NOT a crisis hotline, therapist, or emergency responder.',
  '- If the user speaks about ending their life, self-harm, suicide, severe violence, or immediate danger:',
  '  1. Remain calm, warm, and direct. Do NOT panic or sound robotic.',
  '  2. Prioritize their physical safety immediately.',
  '  3. Remind them gently that you are an AI and encourage them to call emergency services (such as 911, 999, 112, or local emergency dispatch) or reach out to a trusted person right now.',
  '  4. Direct them to Find A Helpline at findahelpline.com or Befrienders Worldwide at befrienders.org for free, confidential international support in their country.',
  '  5. Urge them to step into a safe space away from immediate harm.',
  '  6. Do NOT promise confidentiality or physical protection that software cannot provide.',
].join('\n');

export const VOICE_SAFETY_DISCLOSURE = {
  title: 'Voice Session Safety Notice',
  isMonitoredInRealTime: false,
  emergencyNotice:
    'If you are in danger or having thoughts of self-harm, please immediately contact your local emergency services (911, 999, 112) or call a crisis hotline.',
  summary:
    'NIVA is an AI companion for emotional reflection, not a healthcare provider or crisis intervention service. Real-time voice audio is processed directly by AI and is not monitored by medical personnel. If you are experiencing a mental health crisis or need immediate help, please use the Crisis Resources button or call your local emergency services.',
  guaranteeDisclaimer:
    'NIVA cannot detect every crisis, guarantee safety, or replace professional care.',
};
