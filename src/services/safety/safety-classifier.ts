/**
 * NIVA Modular Safety Classifier
 * Phase 5: Advanced Safety & Crisis Response System
 * 
 * DESIGN PRINCIPLES:
 * 1. Multi-Tiered Evaluation: Classifies messages into NONE, LOW, MODERATE, HIGH.
 * 2. Figurative Speech Filtering: Recognizes everyday idioms ("dying of laughter", "killing time",
 *    "this workout is killer", "my feet are killing me") so ordinary expressions are never misclassified.
 * 3. Non-Escalation of Everyday Distress: Ordinary sadness, stress, exam fatigue, and venting
 *    stay at LOW or MODERATE without being falsely escalated to a crisis.
 * 4. Context Awareness: Looks at word combinations and intent markers without making unsupported assumptions.
 * 5. Modular & Testable: Can be executed independently in unit and integration test suites.
 */

import { SafetyClassificationLevel, SafetyClassificationResult } from '../../../shared/types/safety';

/**
 * Idiomatic phrases that use words like "die" or "kill" in purely colloquial, figurative, or humorous ways.
 */
const FIGURATIVE_IDIOMS: RegExp[] = [
  /\b(dying|dyin|(could|wanna|might)\s+(just\s+)?die)\s+(of|from)\s+(laughter|laughing|fun|amusement|embarrassment|boredom|shame)\b/i,
  /\b(dying|dyin)\s+to\s+(see|hear|meet|know|watch|read|try)\b/i,
  /\b(to\s+die\s+for)\b/i,
  /\b(killing\s+it)\b/i,
  /\b(killing\s+time)\b/i,
  /\b(killer\s+(deal|workout|song|album|shoes|outfit|joke|performance|routine|game|movie))\b/i,
  /\b((my|these)\s+(feet|back|head|knee|legs|throat|neck|shoulder|arm|shoes)\s+(is|are)\s+killing\s+me)\b/i,
  /\b(this\s+([a-z\s]+)?(heat|cold|traffic|workload|deadline|commute|weather|exam|assignment|project)\s+(is\s+)?killing\s+me)\b/i,
];

/**
 * High-risk explicit self-harm, suicide, and immediate physical danger patterns.
 */
const HIGH_RISK_PATTERNS: Array<{ regex: RegExp; category: string }> = [
  // Explicit suicide intent / desire to end life
  { regex: /\b(kill|killing)\s+(my\s*self|myself)\b/i, category: 'SUICIDAL_INTENT' },
  { regex: /\b(commit|committing)\s+suicide\b/i, category: 'SUICIDAL_INTENT' },
  { regex: /\b(end|ending)\s+my\s+life\b/i, category: 'SUICIDAL_INTENT' },
  { regex: /\b(end|ending)\s+it\s+all\b/i, category: 'SUICIDAL_INTENT' },
  { regex: /\bwant\s+to\s+die\b/i, category: 'SUICIDAL_INTENT' },
  { regex: /\bwish\s+i\s+(was|were)\s+dead\b/i, category: 'SUICIDAL_INTENT' },
  { regex: /\bdon'?t\s+want\s+to\s+(live|wake\s+up|exist)\s+(anymore|any\s*more)\b/i, category: 'SUICIDAL_INTENT' },
  { regex: /\b(cannot|can'?t)\s+live\s+(anymore|any\s*more)\b/i, category: 'SUICIDAL_INTENT' },
  { regex: /\b(hang|hanging)\s+myself\b/i, category: 'SUICIDE_METHOD' },
  { regex: /\b(slit|slitting|cut|cutting)\s+(my\s+)?(wrists?|throat|arms?)\b/i, category: 'SUICIDE_METHOD' },
  { regex: /\b(took|swallowed|ingested|taking)\s+([a-z\s]+)?(bottle\s+of\s+pills|all\s+my\s+pills|a\s+bunch\s+of\s+pills|overdose|sleeping\s+pills|lethal\s+dose|poison)\b/i, category: 'SUICIDE_METHOD' },
  { regex: /\b(overdose|overdosing)\b/i, category: 'SUICIDE_METHOD' },
  { regex: /\bhow\s+to\s+(kill\s+myself|commit\s+suicide|end\s+my\s+life|overdose)\b/i, category: 'SUICIDE_METHOD' },
  { regex: /\b(plan\s+to\s+(kill\s+myself|commit\s+suicide|end\s+my\s+life|die))\b/i, category: 'SUICIDAL_PLAN' },
  { regex: /\bsuicidal\s+(thoughts|ideation|urges|plan)\b/i, category: 'SUICIDAL_IDEATION' },
  { regex: /\b(take|taking)\s+my\s+own\s+life\b/i, category: 'SUICIDAL_INTENT' },
  { regex: /\bbetter\s+off\s+dead\b/i, category: 'SUICIDAL_INTENT' },
  { regex: /\b(jump|jumping)\s+in\s+front\s+of\s+(a\s+train|traffic)\b/i, category: 'SUICIDE_METHOD' },
  
  // Severe self-harm
  { regex: /\b(cutting|burning|harming|hurting)\s+myself\b/i, category: 'ACTIVE_SELF_HARM' },
  { regex: /\b(urge|need)\s+to\s+hurt\s+myself\b/i, category: 'ACTIVE_SELF_HARM' },

  // Immediate domestic violence or physical assault
  { regex: /\b(partner|spouse|husband|wife|boyfriend|girlfriend|ex|father|mother)\s+(is\s+hitting|is\s+beating|is\s+choking|threatened\s+to\s+kill)\s+me\b/i, category: 'IMMEDIATE_VIOLENCE' },
  { regex: /\bin\s+danger\s+of\s+being\s+killed\b/i, category: 'IMMEDIATE_VIOLENCE' },
];

/**
 * Moderate distress patterns: deep grief, overwhelming panic, profound isolation, crying spells.
 * These do NOT indicate suicidal intent or immediate danger.
 */
const MODERATE_DISTRESS_PATTERNS: Array<{ regex: RegExp; category: string }> = [
  { regex: /\b(can'?t|cannot)\s+stop\s+crying\b/i, category: 'CRYING_SPELLS' },
  { regex: /\b(crying|weeping)\s+(all\s+(day|night)|uncontrollably|for\s+hours)\b/i, category: 'CRYING_SPELLS' },
  { regex: /\b(panic\s+attack|anxiety\s+attack)\b/i, category: 'ACUTE_ANXIETY' },
  { regex: /\b(feel|feeling|feels)\s+(so\s+|completely\s+)?(empty|numb|worthless|hopeless|broken|dark|pointless)\b/i, category: 'DEEP_SADNESS' },
  { regex: /\b(everything\s+feels\s+(completely\s+)?(hopeless|dark|pointless|empty))\b/i, category: 'DEEP_SADNESS' },
  { regex: /\b(so\s+alone|deeply\s+lonely|no\s+one\s+cares\s+about\s+me)\b/i, category: 'ISOLATION' },
  { regex: /\b(unbearable\s+burden|burden\s+to\s+(everyone|my\s+family))\b/i, category: 'HEAVY_EMOTIONAL_BURDEN' },
  { regex: /\b(grief|grieving)\s+(is\s+consuming|is\s+too\s+much|the\s+loss)\b/i, category: 'ACUTE_GRIEF' },
  { regex: /\bcan'?t\s+take\s+this\s+(pain|sorrow|heartbreak)\s+anymore\b/i, category: 'HEAVY_EMOTIONAL_BURDEN' },
  { regex: /\b(feeling|felt)\s+(overwhelmed|paralyzed)\s+by\s+(everything|life|depression)\b/i, category: 'ACUTE_OVERWHELM' },
];

/**
 * Low distress patterns: everyday frustration, minor stress, tiredness, routine venting.
 */
const LOW_DISTRESS_PATTERNS: Array<{ regex: RegExp; category: string }> = [
  { regex: /\b(stressful\s+day|stressed\s+about|feeling\s+stressed|feel\s+stressed)\b/i, category: 'MILD_STRESS' },
  { regex: /\b(tired|exhausted|need\s+a\s+break|burnout|burnt\s+out)\b/i, category: 'FATIGUE' },
  { regex: /\b(nervous|anxious|feeling\s+anxious)\s+about\s+(an?\s+)?(exam|presentation|interview|meeting|test|call|job)\b/i, category: 'SITUATIONAL_ANXIETY' },
  { regex: /\b(trouble\s+sleeping|insomnia|can'?t\s+sleep|having\s+trouble\s+sleeping)\b/i, category: 'SLEEP_ISSUE' },
  { regex: /\b(work|job)\s+was\s+(really\s+)?(overwhelming|busy|hectic|stressful|hard)\b/i, category: 'WORK_STRESS' },
  { regex: /\b(argument|disagreement|fight)\s+with\s+(my\s+)?(roommate|friend|coworker|brother|sister)\b/i, category: 'INTERPERSONAL_VENTING' },
  { regex: /\b(bad\s+day|rough\s+day|tough\s+week)\b/i, category: 'ROUTINE_VENTING' },
  { regex: /\bhard\s+to\s+focus\b/i, category: 'ATTENTION_CHALLENGE' },
];

/**
 * Sanitizes text to remove known harmless figurative idioms before evaluating crisis terms.
 */
export function stripHarmlessIdioms(input: string): string {
  let cleaned = input;
  for (const idiom of FIGURATIVE_IDIOMS) {
    cleaned = cleaned.replace(idiom, ' [harmless_colloquialism] ');
  }
  return cleaned;
}

/**
 * Evaluates user input and produces a calibrated safety classification.
 */
export function classifyInputSafety(inputText: string): SafetyClassificationResult {
  const text = (inputText || '').trim();
  if (!text) {
    return {
      level: 'NONE',
      matchedCategories: [],
      isImminentHarm: false,
      rationaleSummary: 'EMPTY_INPUT',
    };
  }

  // 1. Strip out recognized figurative idioms (e.g. "dying of laughter", "my feet are killing me")
  const cleanedText = stripHarmlessIdioms(text);

  // 2. Check for HIGH-RISK indicators (suicidal intent, plans, acute domestic violence, self-harm)
  const highRiskMatches: string[] = [];
  for (const item of HIGH_RISK_PATTERNS) {
    if (item.regex.test(cleanedText)) {
      highRiskMatches.push(item.category);
    }
  }

  if (highRiskMatches.length > 0) {
    return {
      level: 'HIGH',
      matchedCategories: Array.from(new Set(highRiskMatches)),
      isImminentHarm: true,
      rationaleSummary: 'IMMINENT_RISK_OR_SELF_HARM_DETECTED',
    };
  }

  // 3. Check for MODERATE distress indicators (severe emotional pain, panic attacks, deep grief without self-harm)
  const moderateMatches: string[] = [];
  for (const item of MODERATE_DISTRESS_PATTERNS) {
    if (item.regex.test(cleanedText)) {
      moderateMatches.push(item.category);
    }
  }

  if (moderateMatches.length > 0) {
    return {
      level: 'MODERATE',
      matchedCategories: Array.from(new Set(moderateMatches)),
      isImminentHarm: false,
      rationaleSummary: 'ELEVATED_EMOTIONAL_DISTRESS',
    };
  }

  // 4. Check for LOW distress indicators (everyday stress, work fatigue, exam anxiety, normal venting)
  const lowMatches: string[] = [];
  for (const item of LOW_DISTRESS_PATTERNS) {
    if (item.regex.test(cleanedText)) {
      lowMatches.push(item.category);
    }
  }

  if (lowMatches.length > 0) {
    return {
      level: 'LOW',
      matchedCategories: Array.from(new Set(lowMatches)),
      isImminentHarm: false,
      rationaleSummary: 'ROUTINE_VENTING_OR_MILD_STRESS',
    };
  }

  // 5. Default: NONE (everyday conversation, mindfulness inquiry, positive or neutral dialogue)
  return {
    level: 'NONE',
    matchedCategories: [],
    isImminentHarm: false,
    rationaleSummary: 'NEUTRAL_OR_WELLNESS_DIALOGUE',
  };
}

/**
 * Convenience wrapper returning distress level and immediate crisis flag.
 */
export function classifyDistressLevel(inputText: string): SafetyClassificationResult & { isImmediateCrisis: boolean } {
  const result = classifyInputSafety(inputText);
  return {
    ...result,
    isImmediateCrisis: result.level === 'HIGH',
  };
}

/**
 * Checks if input text matches any recognized colloquial idiom.
 */
export function isIdiomOrColloquial(text: string): boolean {
  return FIGURATIVE_IDIOMS.some((re) => re.test(text));
}

