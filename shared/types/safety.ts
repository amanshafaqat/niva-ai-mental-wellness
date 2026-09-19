/**
 * NIVA Safety & Crisis Response Shared Types
 * Phase 5: Advanced Safety & Crisis Response System
 * 
 * NIVA is a supportive AI wellness companion, not a licensed medical professional or crisis hotline.
 * It provides empathetic companionship and directs users to verified human resources in times of crisis.
 */

export type SafetyClassificationLevel = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';

export type CrisisResourceType =
  | 'EMERGENCY'          // Immediate police/ambulance/fire dispatch (e.g., 911, 999, 112, 000)
  | 'CRISIS_HELPLINE'    // 24/7 or scheduled telephone crisis intervention
  | 'TEXT_LINE'          // Crisis support via SMS or web chat
  | 'SPECIALIZED'        // Youth, LGBTQ+, domestic violence, or veteran support
  | 'GLOBAL_DIRECTORY';  // International aggregator (e.g., Find A Helpline, Befrienders)

export interface CrisisResource {
  id: string;
  name: string;
  type: CrisisResourceType;
  countryCode: string;   // ISO 3166-1 alpha-2 or 'GLOBAL'
  countryName: string;
  description: string;
  contactNumber?: string;
  smsNumber?: string;
  url?: string;
  isVerified: boolean;
  isUniversalEmergency: boolean;
  hoursOfOperation: string;
  languages: string[];
}

export interface SafetyClassificationResult {
  level: SafetyClassificationLevel;
  matchedCategories: string[];
  isImminentHarm: boolean;
  rationaleSummary: string; // Internal sanitized diagnostic category (not logged with user text)
}

export interface SafetyEvaluationResult {
  classification: SafetyClassificationResult;
  requiresIntervention: boolean;
  supportiveGuidance?: string;
  suggestedResources?: CrisisResource[];
}

export interface CrisisResourceFilterOptions {
  countryCode?: string;
  type?: CrisisResourceType;
  searchQuery?: string;
}

export interface CrisisDirectoryResponseDto {
  verified: boolean;
  selectedCountry?: string;
  availableCountries: Array<{ code: string; name: string }>;
  resources: CrisisResource[];
  globalFallbacks: CrisisResource[];
  disclaimer: string;
}
