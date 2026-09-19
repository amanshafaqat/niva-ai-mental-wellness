/**
 * NIVA International Crisis Resource Registry
 * Phase 5: Advanced Safety & Crisis Response System
 * 
 * DESIGN PRINCIPLES:
 * 1. Global Awareness: Does NOT assume the user is in the United States.
 * 2. Accuracy: Only contains verified, confirmed national and international resources.
 * 3. Separation of Concerns: Explicitly distinguishes immediate emergency dispatch (police/ambulance)
 *    from non-emergency emotional-support helplines and text lines.
 * 4. Privacy: Does not demand location from users. Safe unknown-location guidance recommends
 *    local emergency services and international directories without fabricating specific numbers.
 */

import { CrisisResource } from '../../../shared/types/safety';

export const VERIFIED_CRISIS_RESOURCES: CrisisResource[] = [
  // ---------------------------------------------------------------------------
  // GLOBAL / MULTI-NATIONAL DIRECTORIES (Primary Fallback for Any Region)
  // ---------------------------------------------------------------------------
  {
    id: 'res-global-findahelpline',
    name: 'Find A Helpline',
    type: 'GLOBAL_DIRECTORY',
    countryCode: 'GLOBAL',
    countryName: 'International (130+ Countries)',
    description: 'Free, confidential support from local crisis centers in over 130 countries worldwide.',
    url: 'https://findahelpline.com',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7 Directory',
    languages: ['Multilingual', 'English', 'Spanish', 'French', 'Arabic', 'Hindi'],
  },
  {
    id: 'res-global-befrienders',
    name: 'Befrienders Worldwide',
    type: 'GLOBAL_DIRECTORY',
    countryCode: 'GLOBAL',
    countryName: 'International',
    description: 'Global network of 349 emotional support centers operating across 32 countries.',
    url: 'https://befrienders.org',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7 Directory',
    languages: ['Multilingual'],
  },
  {
    id: 'res-global-iasp',
    name: 'IASP Crisis Centre Directory',
    type: 'GLOBAL_DIRECTORY',
    countryCode: 'GLOBAL',
    countryName: 'International',
    description: 'The International Association for Suicide Prevention directory of crisis centers worldwide.',
    url: 'https://www.iasp.info/resources/Crisis_Centres/',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7 Directory',
    languages: ['Multilingual'],
  },

  // ---------------------------------------------------------------------------
  // UNITED STATES (US)
  // ---------------------------------------------------------------------------
  {
    id: 'res-us-emergency',
    name: 'Emergency Services (US)',
    type: 'EMERGENCY',
    countryCode: 'US',
    countryName: 'United States',
    description: 'Immediate dispatch for police, fire, and medical emergencies.',
    contactNumber: '911',
    isVerified: true,
    isUniversalEmergency: true,
    hoursOfOperation: '24/7',
    languages: ['English', 'Spanish', 'Language Line Translation'],
  },
  {
    id: 'res-us-988',
    name: '988 Suicide & Crisis Lifeline',
    type: 'CRISIS_HELPLINE',
    countryCode: 'US',
    countryName: 'United States',
    description: 'Free, confidential support for people in suicidal crisis or mental health-related distress.',
    contactNumber: '988',
    smsNumber: '988',
    url: 'https://988lifeline.org',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7',
    languages: ['English', 'Spanish', '240+ via translation'],
  },
  {
    id: 'res-us-ctl',
    name: 'Crisis Text Line',
    type: 'TEXT_LINE',
    countryCode: 'US',
    countryName: 'United States',
    description: 'Free, 24/7 crisis support via text with trained crisis counselors.',
    smsNumber: 'Text HOME to 741741',
    url: 'https://www.crisistextline.org',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7',
    languages: ['English', 'Spanish'],
  },
  {
    id: 'res-us-trevor',
    name: 'The Trevor Project',
    type: 'SPECIALIZED',
    countryCode: 'US',
    countryName: 'United States',
    description: 'Confidential suicide prevention and crisis intervention services for LGBTQ young people.',
    contactNumber: '1-866-488-7386',
    smsNumber: 'Text START to 678-678',
    url: 'https://www.thetrevorproject.org',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7',
    languages: ['English'],
  },

  // ---------------------------------------------------------------------------
  // UNITED KINGDOM (GB)
  // ---------------------------------------------------------------------------
  {
    id: 'res-gb-emergency',
    name: 'Emergency Services (UK)',
    type: 'EMERGENCY',
    countryCode: 'GB',
    countryName: 'United Kingdom',
    description: 'Immediate police, ambulance, and fire rescue dispatch (999 or 112).',
    contactNumber: '999',
    isVerified: true,
    isUniversalEmergency: true,
    hoursOfOperation: '24/7',
    languages: ['English', 'Welsh'],
  },
  {
    id: 'res-gb-samaritans',
    name: 'Samaritans (UK & Ireland)',
    type: 'CRISIS_HELPLINE',
    countryCode: 'GB',
    countryName: 'United Kingdom',
    description: 'Free, confidential listening service for anyone struggling to cope or needing someone to talk to.',
    contactNumber: '116 123',
    url: 'https://www.samaritans.org',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7',
    languages: ['English', 'Welsh'],
  },
  {
    id: 'res-gb-shout',
    name: 'Shout Crisis Text Line',
    type: 'TEXT_LINE',
    countryCode: 'GB',
    countryName: 'United Kingdom',
    description: 'Free, confidential, 24/7 text messaging support service in the UK (Text SHOUT to 85258).',
    contactNumber: '85258',
    smsNumber: '85258',
    url: 'https://giveusashout.org',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7',
    languages: ['English'],
  },
  {
    id: 'res-gb-nhs-111',
    name: 'NHS 111 Mental Health Services',
    type: 'SPECIALIZED',
    countryCode: 'GB',
    countryName: 'United Kingdom',
    description: 'Urgent mental health assessment and triage through the National Health Service.',
    contactNumber: '111',
    url: 'https://111.nhs.uk',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7',
    languages: ['English', 'Translation services'],
  },

  // ---------------------------------------------------------------------------
  // CANADA (CA)
  // ---------------------------------------------------------------------------
  {
    id: 'res-ca-emergency',
    name: 'Emergency Services (Canada)',
    type: 'EMERGENCY',
    countryCode: 'CA',
    countryName: 'Canada',
    description: 'Immediate emergency police, fire, and paramedic dispatch across Canada.',
    contactNumber: '911',
    isVerified: true,
    isUniversalEmergency: true,
    hoursOfOperation: '24/7',
    languages: ['English', 'French'],
  },
  {
    id: 'res-ca-988',
    name: '988 Suicide Crisis Helpline (Canada)',
    type: 'CRISIS_HELPLINE',
    countryCode: 'CA',
    countryName: 'Canada',
    description: 'Toll-free, bilingual 24/7 suicide prevention service by call or text across Canada.',
    contactNumber: '988',
    smsNumber: '988',
    url: 'https://988.ca',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7',
    languages: ['English', 'French'],
  },
  {
    id: 'res-ca-kids-help-phone',
    name: 'Kids Help Phone',
    type: 'TEXT_LINE',
    countryCode: 'CA',
    countryName: 'Canada',
    description: 'Free, confidential 24/7 e-mental health service offering support to young people.',
    contactNumber: '1-800-668-6868',
    smsNumber: 'Text 686868',
    url: 'https://kidshelpphone.ca',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7',
    languages: ['English', 'French'],
  },

  // ---------------------------------------------------------------------------
  // AUSTRALIA (AU)
  // ---------------------------------------------------------------------------
  {
    id: 'res-au-emergency',
    name: 'Emergency Services (Australia)',
    type: 'EMERGENCY',
    countryCode: 'AU',
    countryName: 'Australia',
    description: 'Triple Zero (000) immediate dispatch for ambulance, fire, and police in Australia.',
    contactNumber: '000',
    isVerified: true,
    isUniversalEmergency: true,
    hoursOfOperation: '24/7',
    languages: ['English'],
  },
  {
    id: 'res-au-lifeline',
    name: 'Lifeline Australia',
    type: 'CRISIS_HELPLINE',
    countryCode: 'AU',
    countryName: 'Australia',
    description: 'National 24/7 crisis support and suicide prevention services.',
    contactNumber: '13 11 14',
    smsNumber: 'Text 0477 13 11 14',
    url: 'https://www.lifeline.org.au',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7',
    languages: ['English'],
  },
  {
    id: 'res-au-beyondblue',
    name: 'Beyond Blue',
    type: 'CRISIS_HELPLINE',
    countryCode: 'AU',
    countryName: 'Australia',
    description: 'Support service for anxiety, depression, and suicide prevention.',
    contactNumber: '1300 22 4636',
    url: 'https://www.beyondblue.org.au',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7',
    languages: ['English'],
  },

  // ---------------------------------------------------------------------------
  // INDIA (IN)
  // ---------------------------------------------------------------------------
  {
    id: 'res-in-emergency',
    name: 'Emergency Response Support System (ERSS)',
    type: 'EMERGENCY',
    countryCode: 'IN',
    countryName: 'India',
    description: 'National unified emergency number for police, fire, and ambulance services across India.',
    contactNumber: '112',
    isVerified: true,
    isUniversalEmergency: true,
    hoursOfOperation: '24/7',
    languages: ['Hindi', 'English', 'Regional Indian languages'],
  },
  {
    id: 'res-in-telemanas',
    name: 'Tele-MANAS (Govt of India)',
    type: 'CRISIS_HELPLINE',
    countryCode: 'IN',
    countryName: 'India',
    description: 'National Tele Mental Health Programme offering free, confidential 24/7 psychological support (toll-free 14416 or 1800-891-4416).',
    contactNumber: '14416',
    url: 'https://telemanas.mohfw.gov.in',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7',
    languages: ['Hindi', 'English', '20+ Regional languages'],
  },
  {
    id: 'res-in-vandrevala',
    name: 'Vandrevala Foundation',
    type: 'CRISIS_HELPLINE',
    countryCode: 'IN',
    countryName: 'India',
    description: 'Free 24/7 mental health counseling and crisis intervention by professional clinical psychologists.',
    contactNumber: '+91 9999 666 555',
    url: 'https://www.vandrevalafoundation.com',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7',
    languages: ['English', 'Hindi', 'Gujarati', 'Marathi', 'Bengali', 'Tamil', 'Telugu'],
  },
  {
    id: 'res-in-aasra',
    name: 'AASRA',
    type: 'CRISIS_HELPLINE',
    countryCode: 'IN',
    countryName: 'India',
    description: '24/7 helpline providing confidential, non-judgmental support for people experiencing distress or suicidal crisis.',
    contactNumber: '+91 98204 66726',
    url: 'http://www.aasra.info',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7',
    languages: ['English', 'Hindi'],
  },

  // ---------------------------------------------------------------------------
  // NEW ZEALAND (NZ)
  // ---------------------------------------------------------------------------
  {
    id: 'res-nz-emergency',
    name: 'Emergency Services (New Zealand)',
    type: 'EMERGENCY',
    countryCode: 'NZ',
    countryName: 'New Zealand',
    description: 'Immediate police, fire, and ambulance dispatch.',
    contactNumber: '111',
    isVerified: true,
    isUniversalEmergency: true,
    hoursOfOperation: '24/7',
    languages: ['English', 'Te Reo Māori'],
  },
  {
    id: 'res-nz-1737',
    name: '1737 Need to Talk?',
    type: 'CRISIS_HELPLINE',
    countryCode: 'NZ',
    countryName: 'New Zealand',
    description: 'Free call or text 24/7 to speak with a trained mental health counselor.',
    contactNumber: '1737',
    smsNumber: 'Text 1737',
    url: 'https://1737.org.nz',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: '24/7',
    languages: ['English'],
  },

  // ---------------------------------------------------------------------------
  // EUROPEAN UNION / PAN-EUROPE (EU)
  // ---------------------------------------------------------------------------
  {
    id: 'res-eu-emergency',
    name: 'European Emergency Number',
    type: 'EMERGENCY',
    countryCode: 'EU',
    countryName: 'European Union (Universal)',
    description: 'Single emergency phone number reachable free of charge across all 27 EU member states from any phone.',
    contactNumber: '112',
    isVerified: true,
    isUniversalEmergency: true,
    hoursOfOperation: '24/7',
    languages: ['Official EU Languages'],
  },
  {
    id: 'res-eu-emotional-support',
    name: 'Pan-European Emotional Support Helpline',
    type: 'CRISIS_HELPLINE',
    countryCode: 'EU',
    countryName: 'European Union',
    description: 'Harmonized European emotional support hotline available in participating member states.',
    contactNumber: '116 123',
    url: 'https://www.befrienders.org',
    isVerified: true,
    isUniversalEmergency: false,
    hoursOfOperation: 'Varies by member state',
    languages: ['Local European languages'],
  },
];

export const SUPPORTED_COUNTRIES: Array<{ code: string; name: string }> = [
  { code: 'GLOBAL', name: 'International / Other Countries' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'IN', name: 'India' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'EU', name: 'European Union' },
];

/**
 * Returns verified crisis resources for a specified country code,
 * combined with global fallback directories.
 */
export function getCrisisResourcesForCountry(countryCode?: string): CrisisResource[] {
  const normalizedCode = (countryCode || '').trim().toUpperCase();
  const globalResources = VERIFIED_CRISIS_RESOURCES.filter((r) => r.countryCode === 'GLOBAL');

  if (!normalizedCode || normalizedCode === 'GLOBAL' || normalizedCode === 'UNKNOWN') {
    return globalResources;
  }

  const countryResources = VERIFIED_CRISIS_RESOURCES.filter((r) => r.countryCode === normalizedCode);
  if (countryResources.length === 0) {
    // Unknown or unlisted country: return verified global fallbacks
    return globalResources;
  }

  return [...countryResources, ...globalResources];
}

/**
 * Provides safe, neutral crisis advice for unknown locations without fabricating fake local numbers.
 */
export function getSafeUnknownLocationGuidance(): {
  guidanceText: string;
  globalDirectories: CrisisResource[];
} {
  return {
    guidanceText:
      'If you are in immediate physical danger, please contact your local emergency services (such as police or ambulance in your country), or reach out to a trusted person who can be with you right now. For free, confidential crisis counseling anywhere in the world, you can connect directly with local helplines via Find A Helpline (findahelpline.com) or Befrienders Worldwide (befrienders.org).',
    globalDirectories: VERIFIED_CRISIS_RESOURCES.filter((r) => r.countryCode === 'GLOBAL'),
  };
}

/**
 * Resolves the primary universal emergency dispatch number for a given country.
 */
export function getEmergencyNumberForCountry(countryCode?: string): string {
  const resources = getCrisisResourcesForCountry(countryCode);
  const emergency = resources.find((r) => r.type === 'EMERGENCY');
  return emergency?.contactNumber || '112';
}

