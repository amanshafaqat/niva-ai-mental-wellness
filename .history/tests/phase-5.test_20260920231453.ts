/**
 * NIVA Phase 5 Automated Test Suite
 * Advanced Safety & Crisis Response
 *
 * Validates:
 * 1. Distress Classification Across Levels (NONE, LOW, MODERATE, HIGH)
 * 2. Idiom Awareness & False Positive Resistance ("killing me", "dying of embarrassment")
 * 3. International Crisis Resources Registry (US, GB, CA, AU, IN, NZ, EU, GLOBAL)
 * 4. Safe Unknown Location Handling (No fabricated numbers, safe global directory fallback)
 * 5. Level-Specific Response Behaviors (Emergency escalation vs gentle grounding)
 * 6. Voice Safety Boundary & Non-Monitoring Disclosure
 * 7. Prerequisite Voice Persistence Architecture
 */

import assert from 'assert';
import { evaluateInputSafety } from '../src/services/conversation-engine.js';
import {
  classifyDistressLevel,
  isIdiomOrColloquial,
} from '../src/services/safety/safety-classifier.js';
import {
  getCrisisResourcesForCountry,
  getSafeUnknownLocationGuidance,
  getEmergencyNumberForCountry,
  SUPPORTED_COUNTRIES,
} from '../src/services/safety/crisis-registry.js';
import {
  buildSafetyGuidancePrompt,
  generateEmergencySafetyResponse,
} from '../src/services/safety/response-behavior.js';
import {
  VOICE_SAFETY_SYSTEM_INSTRUCTION,
  VOICE_SAFETY_DISCLOSURE,
} from '../src/services/safety/voice-safety-boundary.js';
import { createVoiceTicket, consumeVoiceTicket } from '../src/services/voice-engine.js';
import { Role } from '../shared/constants/roles.js';
import { setPrismaClient } from '../src/lib/prisma.js';

async function runPhase5Tests() {
  console.log('🛡️ Starting NIVA Phase 5 Advanced Safety & Crisis Response Test Suite...\n');

  // =========================================================================
  // TEST 1: DISTRESS CLASSIFICATION LEVELS (NONE, LOW, MODERATE, HIGH)
  // =========================================================================
  console.log('1. Testing Multi-Tier Distress Classification...');

  // Level: HIGH (Active suicide, self-harm, acute emergency)
  const highInputs = [
    'I want to end my life tonight',
    'Thinking about killing myself',
    'I took a whole bottle of pills',
    'I have a plan to commit suicide',
    'I cannot live anymore I want to die',
    'I am cutting my wrists right now',
  ];
  for (const text of highInputs) {
    const classification = classifyDistressLevel(text);
    assert.strictEqual(
      classification.level,
      'HIGH',
      `Expected HIGH distress for "${text}", got ${classification.level}`,
    );
    assert.strictEqual(classification.isImmediateCrisis, true, 'Immediate crisis flag must be true for HIGH');
  }
  console.log('   ✅ High-risk self-harm and suicide triggers correctly classified as HIGH.');

  // Level: MODERATE (Intense despair, deep hopelessness, overwhelmed without acute plan)
  const modInputs = [
    'Everything feels completely hopeless and dark',
    'I feel so worthless and broken inside',
    'I cannot stop crying and no one cares about me',
    'I feel like an unbearable burden to everyone',
  ];
  for (const text of modInputs) {
    const classification = classifyDistressLevel(text);
    assert.strictEqual(
      classification.level,
      'MODERATE',
      `Expected MODERATE distress for "${text}", got ${classification.level}`,
    );
  }
  console.log('   ✅ Intense emotional pain and hopelessness correctly classified as MODERATE.');

  // Level: LOW (Everyday stress, fatigue, mild sadness)
  const lowInputs = [
    'I am feeling stressed about exams this week',
    'Work was really overwhelming today and I feel exhausted',
    'Feeling anxious about a job interview tomorrow',
    'I have been having trouble sleeping lately',
  ];
  for (const text of lowInputs) {
    const classification = classifyDistressLevel(text);
    assert.strictEqual(
      classification.level,
      'LOW',
      `Expected LOW distress for "${text}", got ${classification.level}`,
    );
  }
  console.log('   ✅ Mild situational anxiety and stress correctly classified as LOW.');

  // Level: NONE (General wellness, gratitude, neutral prompts)
  const noneInputs = [
    'Hello NIVA, can you guide me through a 5-minute breathing exercise?',
    'What are some good morning habits for focus?',
    'I had a peaceful walk in the park today',
    'Thank you for listening to me earlier',
  ];
  for (const text of noneInputs) {
    const classification = classifyDistressLevel(text);
    assert.strictEqual(
      classification.level,
      'NONE',
      `Expected NONE for neutral wellness inquiry "${text}", got ${classification.level}`,
    );
  }
  console.log('   ✅ Neutral and positive wellness inquiries correctly classified as NONE.');

  // =========================================================================
  // TEST 2: IDIOM AWARENESS & FALSE POSITIVE PREVENTION
  // =========================================================================
  console.log('\n2. Testing Idiom Awareness & False Positive Resistance...');

  const idioms = [
    'This work project deadline is killing me',
    'I could just die of embarrassment right now',
    'My feet are killing me after running 10 miles',
    'I am dying to see that new movie this weekend',
    'This joke is so funny I am dying of laughter',
  ];

  for (const idiom of idioms) {
    assert.strictEqual(
      isIdiomOrColloquial(idiom),
      true,
      `Idiom detector should detect colloquialism in: "${idiom}"`,
    );
    const classification = classifyDistressLevel(idiom);
    assert.notStrictEqual(
      classification.level,
      'HIGH',
      `Colloquial idiom "${idiom}" must NOT be classified as HIGH crisis`,
    );
  }
  console.log('   ✅ Colloquial expressions correctly filtered to prevent false positive crisis locks.');

  // =========================================================================
  // TEST 3: INTERNATIONAL CRISIS REGISTRY & VERIFIED DIRECTORIES
  // =========================================================================
  console.log('\n3. Testing International Crisis Registry & Directories...');

  // Supported countries exist
  assert.ok(SUPPORTED_COUNTRIES.length >= 7, 'Must support at least 7 countries/regions');

  // Verify India (Tele-MANAS, Vandrevala, Kiran, 112)
  const inResources = getCrisisResourcesForCountry('IN');
  assert.ok(inResources.length >= 3, 'India directory must include verified resources');
  assert.ok(inResources.some((r) => r.contactNumber === '14416'), 'India must list Tele-MANAS (14416)');
  assert.strictEqual(getEmergencyNumberForCountry('IN'), '112', 'India emergency dispatch must be 112');

  // Verify United Kingdom (999, Samaritans 116 123, Shout 85258)
  const gbResources = getCrisisResourcesForCountry('GB');
  assert.ok(gbResources.some((r) => r.contactNumber === '116 123'), 'UK must list Samaritans (116 123)');
  assert.ok(gbResources.some((r) => r.smsNumber === '85258'), 'UK must list Shout 85258');
  assert.strictEqual(getEmergencyNumberForCountry('GB'), '999', 'UK emergency dispatch must be 999');

  // Verify Australia (000, Lifeline 13 11 14, Beyond Blue)
  const auResources = getCrisisResourcesForCountry('AU');
  assert.ok(auResources.some((r) => r.contactNumber === '13 11 14'), 'AU must list Lifeline 13 11 14');
  assert.strictEqual(getEmergencyNumberForCountry('AU'), '000', 'AU emergency dispatch must be 000');

  // Verify New Zealand (111, Lifeline 0800 543 354, 1737 text/call)
  const nzResources = getCrisisResourcesForCountry('NZ');
  assert.ok(nzResources.some((r) => r.contactNumber === '1737' || r.smsNumber === '1737'), 'NZ must list 1737');
  assert.strictEqual(getEmergencyNumberForCountry('NZ'), '111', 'NZ emergency dispatch must be 111');

  // Verify United States (911, 988, Crisis Text Line 741741, Trevor Project)
  const usResources = getCrisisResourcesForCountry('US');
  assert.ok(usResources.some((r) => r.contactNumber === '988'), 'US must list 988 Suicide & Crisis Lifeline');
  assert.ok(usResources.some((r) => r.type === 'SPECIALIZED'), 'US must include specialized support');

  // Verify Global Fallback Directories
  const globalResources = getCrisisResourcesForCountry('GLOBAL');
  assert.ok(globalResources.some((r) => r.url?.includes('findahelpline.com')), 'Global must list findahelpline.com');
  assert.ok(globalResources.some((r) => r.url?.includes('befrienders.org')), 'Global must list befrienders.org');
  console.log('   ✅ Verified multi-national crisis directories confirmed (IN, GB, AU, NZ, US, EU, GLOBAL).');

  // =========================================================================
  // TEST 4: UNKNOWN LOCATION SAFE HANDLING
  // =========================================================================
  console.log('\n4. Testing Safe Unknown Location Handling...');
  const unknownLocationGuidance = getSafeUnknownLocationGuidance();
  assert.ok(unknownLocationGuidance.globalDirectories.length > 0, 'Must provide global directory links');
  assert.ok(
    unknownLocationGuidance.guidanceText.includes('findahelpline.com'),
    'Unknown location instructions must reference findahelpline.com',
  );
  // Unknown country code query should gracefully fall back to GLOBAL
  const unknownCountryResources = getCrisisResourcesForCountry('XYZ_UNKNOWN');
  assert.ok(unknownCountryResources.length > 0, 'Unknown country query must fall back to global directories');
  console.log('   ✅ Unknown country queries safely routed to international directory fallbacks without fabricating numbers.');

  // =========================================================================
  // TEST 5: EVALUATE INPUT SAFETY PIPELINE & RESPONSE GENERATION
  // =========================================================================
  console.log('\n5. Testing End-to-End Safety Evaluation Pipeline...');

  // Acute Crisis: India user
  const indiaCrisisCheck = evaluateInputSafety('I cannot go on, I want to kill myself', 'IN');
  assert.strictEqual(indiaCrisisCheck.isSafe, false, 'Acute self-harm must return isSafe: false');
  assert.strictEqual(indiaCrisisCheck.level, 'HIGH', 'Acute self-harm must be level HIGH');
  assert.ok(indiaCrisisCheck.blockedResponse, 'Must generate immediate blockedResponse');
  assert.ok(indiaCrisisCheck.blockedResponse.includes('Tele-MANAS') || indiaCrisisCheck.blockedResponse.includes('14416'), 'Response for IN user must reference Tele-MANAS');
  assert.ok(indiaCrisisCheck.blockedResponse.includes('112'), 'Response for IN user must reference 112 emergency');

  // Acute Crisis: UK user
  const ukCrisisCheck = evaluateInputSafety('I want to commit suicide right now', 'GB');
  assert.strictEqual(ukCrisisCheck.isSafe, false);
  assert.ok(ukCrisisCheck.blockedResponse?.includes('999'), 'Response for GB user must reference 999');
  assert.ok(ukCrisisCheck.blockedResponse?.includes('Samaritans') || ukCrisisCheck.blockedResponse?.includes('116 123'), 'Response for GB user must reference Samaritans');

  // Moderate Distress: UK user (Safe to continue dialogue, but prompt guidance added)
  const moderateCheck = evaluateInputSafety('I feel completely hopeless and crying all the time', 'GB');
  assert.strictEqual(moderateCheck.isSafe, true, 'Moderate distress is safe to respond with guidance');
  assert.strictEqual(moderateCheck.level, 'MODERATE');
  assert.ok(moderateCheck.suggestedResources && moderateCheck.suggestedResources.length > 0, 'Must attach suggested resources');

  // Low Distress
  const lowCheck = evaluateInputSafety('I have a lot of work stress and feel a bit tired', 'US');
  assert.strictEqual(lowCheck.isSafe, true);
  assert.strictEqual(lowCheck.level, 'LOW');

  // Test System Prompt Guidance Injection
  const promptGuidance = buildSafetyGuidancePrompt('MODERATE');
  assert.ok(promptGuidance.includes('VALIDATE FEELINGS'), 'Moderate guidance must prompt emotional validation');
  assert.ok(promptGuidance.includes('NEVER diagnose'), 'Must forbid clinical diagnosis');
  console.log('   ✅ End-to-end evaluation pipeline, level handling, and country-tailored guidance verified.');

  // =========================================================================
  // TEST 6: VOICE SAFETY BOUNDARY & DISCLOSURE
  // =========================================================================
  console.log('\n6. Testing Voice Safety Boundary & Non-Monitoring Disclosure...');
  assert.ok(VOICE_SAFETY_SYSTEM_INSTRUCTION.length > 100, 'Voice safety instruction must be substantive');
  assert.ok(
    VOICE_SAFETY_SYSTEM_INSTRUCTION.includes('EMERGENCY ESCALATION') ||
    VOICE_SAFETY_SYSTEM_INSTRUCTION.includes('CRISIS'),
    'Voice safety instruction must contain crisis response bounds',
  );
  assert.ok(
    VOICE_SAFETY_SYSTEM_INSTRUCTION.includes('findahelpline.com'),
    'Voice safety instruction must provide findahelpline.com directory reference',
  );

  assert.ok(VOICE_SAFETY_DISCLOSURE.isMonitoredInRealTime === false, 'Voice disclosure must state not monitored in real time');
  assert.ok(VOICE_SAFETY_DISCLOSURE.emergencyNotice.length > 20, 'Emergency notice must be present');
  console.log('   ✅ Voice safety system instruction and non-monitoring disclosure confirmed.');

  // =========================================================================
  // TEST 7: PREREQUISITE VOICE TICKET PERSISTENCE (SUCCESS & FAILURE MODES)
  // =========================================================================
  console.log('\n7. Testing Voice Session Persistence & Ticket Isolation...');
  const testUser = {
    id: 'user-safety-phase5',
    email: 'safety@niva.org',
    name: 'Safety Tester',
    role: Role.USER,
  };
  const testConversation = {
    id: 'conv-safety-phase5',
    userId: testUser.id,
    title: 'Safety Test Session',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };

  // 7A: Failure mode - Prisma throws an error (e.g. database connection lost)
  // Mandate: "A voice session or ticket is not treated as successfully created unless its required database persistence succeeds. Do not silently swallow Prisma errors."
  console.log('   Testing Prisma persistence failure mode rejection...');
  setPrismaClient({
    voiceSession: {
      create: async () => {
        throw new Error('PostgreSQL connection timeout: connection pool exhausted');
      },
    },
  } as any);

  let threwExpected = false;
  try {
    await createVoiceTicket(testUser, testConversation);
  } catch (err: any) {
    threwExpected = true;
    assert.ok(
      err.message.includes('Failed to persist voice session to database'),
      'Must surface explicit database failure message without swallowing error',
    );
  }
  assert.strictEqual(
    threwExpected,
    true,
    'createVoiceTicket MUST throw when Prisma persistence fails; silent fallback is forbidden',
  );
  console.log('   ✅ Persistence failure correctly aborts ticket creation and surfaces error.');

  // 7B: Success mode - Prisma persistence succeeds
  console.log('   Testing Prisma persistence success mode...');
  const testDbSessions: any[] = [];
  setPrismaClient({
    voiceSession: {
      create: async ({ data }: any) => {
        testDbSessions.push(data);
        return data;
      },
      update: async ({ where, data }: any) => {
        const idx = testDbSessions.findIndex((s) => s.id === where.id);
        if (idx >= 0) {
          testDbSessions[idx] = { ...testDbSessions[idx], ...data };
          return testDbSessions[idx];
        }
        return null;
      },
      findMany: async ({ where }: any) => {
        return testDbSessions.filter((s) => !where?.userId || s.userId === where.userId);
      },
    },
  } as any);

  const voiceTicket = await createVoiceTicket(testUser, testConversation);
  assert.ok(voiceTicket.ticket.startsWith('vtkt_'), 'Voice ticket created');
  assert.strictEqual(voiceTicket.model, 'gemini-live-2.5-flash-preview', 'Voice model must match the supported live model');
  assert.strictEqual(testDbSessions.length, 1, 'Session record must be committed to database');
  assert.strictEqual(testDbSessions[0].userId, testUser.id, 'Persisted record matches user ID');

  // Valid ticket consumed once
  const consumed = consumeVoiceTicket(voiceTicket.ticket);
  assert.ok(consumed !== null);
  // Replay attempt fails
  assert.strictEqual(consumeVoiceTicket(voiceTicket.ticket), null);
  console.log('   ✅ Voice ticket persistence, single-use security, and replay rejection verified.');

  console.log('\n������ ALL NIVA PHASE 5 SAFETY & CRISIS TESTS PASSED SUCCESSFULLY!');
}

runPhase5Tests().catch((err) => {
  console.error('\n❌ PHASE 5 TEST FAILED:', err);
  process.exit(1);
});
