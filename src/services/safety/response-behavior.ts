/**
 * NIVA Supportive Response Behavior Engine
 * Phase 5: Advanced Safety & Crisis Response System
 * 
 * DESIGN PRINCIPLES:
 * 1. Proportionality: Response tone matches the user's distress level.
 * 2. High-Risk Safety First: Direct, compassionate, encourages immediate human help and safer physical environment.
 * 3. Anti-Platitude: Strictly avoids generic motivational slogans ("Smile!", "Life gets better!") during crises.
 * 4. Transparent Boundaries: Never makes promises of confidentiality or physical protection that software cannot guarantee.
 * 5. International Inclusivity: Provides country-specific emergency and crisis services, with safe fallbacks for unknown locations.
 */

import { SafetyClassificationLevel, SafetyEvaluationResult, CrisisResource } from '../../../shared/types/safety';
import { classifyInputSafety } from './safety-classifier';
import { getCrisisResourcesForCountry, getSafeUnknownLocationGuidance } from './crisis-registry';

/**
 * Generates immediate, compassionate high-risk guidance.
 * Focuses on safety, moving away from immediate danger, connecting with another person,
 * and reaching local emergency or crisis lines.
 */
export function generateImmediateCrisisGuidance(userCountryCode?: string): {
  message: string;
  resources: CrisisResource[];
} {
  const resources = getCrisisResourcesForCountry(userCountryCode);
  const emergencyService = resources.find((r) => r.type === 'EMERGENCY');
  const helpline = resources.find((r) => r.type === 'CRISIS_HELPLINE');

  let emergencyDirectPrompt = 'please contact your local emergency services (such as 911, 999, 112, or your local emergency dispatch)';
  if (emergencyService && emergencyService.contactNumber) {
    emergencyDirectPrompt = `please call your emergency services immediately at ${emergencyService.contactNumber}`;
  }

  let helplinePrompt = 'or connect with a confidential crisis counselor through Find A Helpline (findahelpline.com)';
  if (helpline && helpline.contactNumber) {
    helplinePrompt = `or contact ${helpline.name} at ${helpline.contactNumber}`;
  }

  const message = [
    'I hear how much pain you are experiencing right now, and your safety is what matters most.',
    'Because I am an AI wellness companion, I cannot provide emergency, medical, or crisis intervention care.',
    `If you are in immediate danger or thinking of hurting yourself, ${emergencyDirectPrompt}, ${helplinePrompt}, or reach out immediately to someone you trust who can physically be with you right now.`,
    'If you are near anything that could cause you harm, please take a gentle breath, step away into a safer space, and connect with someone who can support you. You do not have to carry this alone.',
  ].join(' ');

  return { message, resources };
}

/**
 * Builds system prompt additions that instruct the AI model on how to converse
 * based on the classified safety level.
 */
export function buildSafetyPromptInstructions(level: SafetyClassificationLevel): string {
  switch (level) {
    case 'HIGH':
      return [
        'CRITICAL SAFETY DIRECTIVE (HIGH RISK DETECTED):',
        '- The user is expressing acute distress, self-harm, or potential danger.',
        '- Prioritize immediate physical safety above everything else.',
        '- Respond with calm, direct, compassionate clarity.',
        '- Encourage reaching out immediately to local emergency services or a trusted in-person support.',
        '- Encourage moving away from immediate sources of danger toward a safer room or another person.',
        '- DO NOT use generic motivational platitudes, cheerful slogans, or dismissive optimism.',
        '- DO NOT make promises of confidentiality or physical safety that an AI cannot guarantee.',
        '- Keep response concise, grounded, and focused on safety.',
      ].join('\n');

    case 'MODERATE':
      return [
        'EMPATHETIC SUPPORT DIRECTIVE (MODERATE DISTRESS DETECTED):',
        '- The user is experiencing heightened distress, deep sadness, or anxiety without active self-harm intent.',
        '- VALIDATE FEELINGS: Warmly acknowledge and validate their emotional experience with empathy and respect.',
        '- Ask ONE brief, relevant follow-up question to help them reflect safely.',
        '- Gently encourage speaking with a trusted friend, family member, or healthcare professional if helpful.',
        '- BOUNDARIES: NEVER diagnose medical or psychological conditions, prescribe medication, or claim to replace professional healthcare.',
        '- Avoid sounding robotic, dismissive, or alarmist. Do NOT overwhelm with unsolicited long lists of advice.',
      ].join('\n');

    case 'LOW':
      return [
        'GENTLE LISTENING DIRECTIVE (ROUTINE STRESS / VENTING):',
        '- The user is discussing everyday stress, fatigue, or situational challenges.',
        '- Listen warmly without judgment. Validate their experience.',
        '- Offer at most ONE small, practical coping perspective if appropriate.',
        '- Avoid long bulleted lists of advice.',
      ].join('\n');

    case 'NONE':
    default:
      return [
        'STANDARD WELLNESS COMPANION DIRECTIVE:',
        '- Maintain a warm, calm, reflective, and conversational presence.',
        '- Listen actively and respond thoughtfully to their reflections.',
      ].join('\n');
  }
}

/**
 * Evaluates user input and produces a comprehensive safety evaluation result.
 */
export function evaluateSafetyAndSupport(
  inputText: string,
  userCountryCode?: string,
): SafetyEvaluationResult {
  const classification = classifyInputSafety(inputText);

  if (classification.level === 'HIGH') {
    const { message, resources } = generateImmediateCrisisGuidance(userCountryCode);
    return {
      classification,
      requiresIntervention: true,
      supportiveGuidance: message,
      suggestedResources: resources,
    };
  }

  if (classification.level === 'MODERATE') {
    // For moderate distress, provide optional supportive resources quietly (not blocking conversation)
    const resources = getCrisisResourcesForCountry(userCountryCode).filter(
      (r) => r.type !== 'EMERGENCY',
    );
    return {
      classification,
      requiresIntervention: false,
      suggestedResources: resources.slice(0, 3),
    };
  }

  return {
    classification,
    requiresIntervention: false,
  };
}

// Aliases for clear semantic caller usage
export const buildSafetyGuidancePrompt = buildSafetyPromptInstructions;
export const generateEmergencySafetyResponse = generateImmediateCrisisGuidance;
