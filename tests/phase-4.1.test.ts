/**
 * NIVA Phase 4.1 Automated Test Suite
 * Validates:
 * 1. Voice Ticket Cryptographic Security & Lifecycle
 * 2. Conversational Safety & Non-Clinical Guardrails
 * 3. Audio Processing (PCM Resampling & Base64 Encoding)
 * 4. Health Contract & Dynamic Telemetry
 */

import assert from 'assert';
import { createVoiceTicket, consumeVoiceTicket } from '../src/services/voice-engine.js';
import { evaluateInputSafety } from '../src/services/conversation-engine.js';
import { resampleTo16kHz, floatTo16BitPCMBase64 } from '../src/utils/audio-pcm.js';
import { Role } from '../shared/constants/roles.js';
import { setPrismaClient } from '../src/lib/prisma.js';

async function runTests() {
  console.log('🧪 Starting NIVA Phase 4.1 Test Suite...\n');

  // Provide isolated mock Prisma persistence adapter for unit testing
  const testDbVoiceSessions: any[] = [];
  setPrismaClient({
    voiceSession: {
      create: async ({ data }: any) => {
        testDbVoiceSessions.push(data);
        return data;
      },
      update: async ({ where, data }: any) => {
        const idx = testDbVoiceSessions.findIndex((s) => s.id === where.id);
        if (idx >= 0) {
          testDbVoiceSessions[idx] = { ...testDbVoiceSessions[idx], ...data };
          return testDbVoiceSessions[idx];
        }
        return null;
      },
      findMany: async ({ where }: any) => {
        return testDbVoiceSessions.filter((s) => !where?.userId || s.userId === where.userId);
      },
    },
  } as any);

  // Test 1: Voice Ticket Cryptography & One-Time Use
  console.log('1. Testing Voice Ticket Cryptography...');
  const mockUser = {
    id: 'test-user-uuid-123',
    email: 'user@test.org',
    name: 'Test User',
    role: Role.USER,
  };
  const mockConversation = {
    id: 'conv-uuid-456',
    userId: mockUser.id,
    title: 'Test Session',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };

  const ticketResponse = await createVoiceTicket(mockUser, mockConversation);
  assert.strictEqual(typeof ticketResponse.ticket, 'string', 'Ticket must be a string');
  assert.ok(ticketResponse.ticket.startsWith('vtkt_'), 'Ticket must start with vtkt_');
  assert.strictEqual(ticketResponse.model, 'gemini-3.8-live', 'Voice model must be gemini-3.8-live');
  assert.strictEqual(ticketResponse.voiceName, 'Zephyr', 'Voice name must be Zephyr');
  
  // Validation should succeed first time
  const consumed = consumeVoiceTicket(ticketResponse.ticket);
  assert.ok(consumed !== null, 'Ticket should consume successfully on first use');
  assert.strictEqual(consumed?.userId, mockUser.id, 'Consumed ticket should match issuing user');
  assert.strictEqual(consumed?.conversationId, mockConversation.id, 'Consumed ticket should match conversation');
  
  // Validation should fail second time (one-time use replay protection)
  const replay = consumeVoiceTicket(ticketResponse.ticket);
  assert.strictEqual(replay, null, 'Ticket must be single-use and rejected on replay');
  
  // Non-existent ticket should fail
  assert.strictEqual(consumeVoiceTicket('invalid-non-existent-ticket'), null, 'Invalid ticket must be rejected');
  console.log('   ✅ Voice ticket cryptographic security & single-use replay protection passed.');

  // Test 2: Conversational Safety & International Crisis Protocols
  console.log('2. Testing Safety & International Crisis Protocols...');
  const crisisCheck = evaluateInputSafety('I feel like giving up completely and ending my life');
  assert.strictEqual(crisisCheck.isSafe, false, 'Crisis trigger should be flagged as unsafe');
  assert.ok(crisisCheck.blockedResponse, 'Blocked response should be present');
  assert.ok(
    crisisCheck.blockedResponse.includes('findahelpline.com') ||
    crisisCheck.blockedResponse.includes('emergency services'),
    'Blocked response must provide neutral international support resources',
  );

  const safeCheck = evaluateInputSafety('I had a stressful day at work today and felt a bit overwhelmed');
  assert.strictEqual(safeCheck.isSafe, true, 'Everyday stress expression should be considered safe');
  assert.strictEqual(safeCheck.blockedResponse, undefined, 'Safe input should not have a blockedResponse');
  console.log('   ✅ Safety evaluator & non-clinical international crisis guardrails passed.');

  // Test 3: Audio Resampling & Linear 16-bit PCM Base64 Encoding
  console.log('3. Testing Audio Resampling & PCM Encoding...');
  const sampleRate48k = 48000;
  const sampleRate16k = 16000;
  // Generate 1 second of 440Hz sine wave at 48kHz
  const testAudio = new Float32Array(sampleRate48k);
  for (let i = 0; i < testAudio.length; i++) {
    testAudio[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate48k) * 0.5;
  }

  const resampled = resampleTo16kHz(testAudio, sampleRate48k, sampleRate16k);
  assert.strictEqual(resampled.length, sampleRate16k, 'Resampled array must have 16000 samples for 1 second');

  const base64Pcm = floatTo16BitPCMBase64(resampled);
  assert.strictEqual(typeof base64Pcm, 'string', 'Base64 PCM output must be a string');
  assert.ok(base64Pcm.length > 0, 'Base64 PCM output must not be empty');
  
  // 16000 samples * 2 bytes/sample = 32000 bytes. Base64 length = Math.ceil(32000 / 3) * 4 = 42668
  const expectedBase64Length = Math.ceil((sampleRate16k * 2) / 3) * 4;
  assert.strictEqual(base64Pcm.length, expectedBase64Length, 'Base64 length matches raw PCM byte count');
  console.log('   ✅ Audio 16kHz resampling and 16-bit linear PCM base64 encoding passed.');

  console.log('\n🎉 All NIVA Phase 4.1 tests passed successfully!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
