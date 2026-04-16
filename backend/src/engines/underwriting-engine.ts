/*
 * Underwriting Engine — Who Gets Covered
 *
 * Underwriting Core Algorithms:
 *   - Active gig worker on Zomato / Swiggy / Zepto / Blinkit / Amazon Flex
 *   - Minimum 7 active delivery days before cover starts
 *   - City-based pools — Delhi AQI pool ≠ Mumbai rain pool
 *   - Workers with < 5 active days in 30 → lower tier
 *   - Keep underwriting and onboarding under 4-5 steps
 *   - Adverse Selection Lock: No retroactive enrollment during active disasters
 *   - Ward-level zone validation for hyper-local risk profiles
 *   - Cost model: platform fee + operational margin tracking
 */

import { classifyActivityTier, getCityPool, PREMIUM_TIERS } from './premium-engine';

export interface UnderwritingInput {
  platform: string;
  isMultiApping: boolean; // e.g., working for Swiggy and Zomato
  city: string;
  zone: string;
  totalActiveDeliveryDays: number;   // lifetime active days
  daysWorkedThisWeek: number;        // current week activity
  daysActiveInLast30: number;        // monthly activity
  avgWeeklyIncome: number;
  vehicleType: string;
  // SS Code & DPDP Act 2023 Compliance
  dpdpConsents: {
    gpsLocation: boolean;   // Separate consent screen required
    bankUpi: boolean;       // Explicit consent + KYC
    platformActivity: boolean; // Data sharing agreement
  };
  // Optional: enrollment timing (for adverse selection check)
  enrollmentTimestamp?: string; // ISO string of when they're trying to enroll
}

export interface UnderwritingResult {
  eligible: boolean;
  reason: string;
  activityTier: 'basic' | 'standard' | 'premium' | 'ineligible';
  cityPool: string;
  recommendedPlan: string;
  weeklyPremium: number;
  maxPayoutPerWeek: number;
  warnings: string[];
  steps: string[];
  costModel?: {
    platformFeePercent: number;
    operationalMarginPercent: number;
    reinsurancePercent: number;
    effectivePremiumToPool: number;
  };
  wardValidation?: {
    zone: string;
    city: string;
    wardResolved: boolean;
    riskTier: 'low' | 'medium' | 'high';
  };
}

const ALLOWED_PLATFORMS = ['Zomato', 'Swiggy', 'Amazon Flex', 'Blinkit', 'Zepto'];

/* ─── Ward-Level Zone Risk Mapping ─── */
const WARD_RISK_MAP: Record<string, Record<string, 'low' | 'medium' | 'high'>> = {
  'Mumbai': {
    'Andheri East': 'medium', 'Andheri West': 'medium', 'Bandra': 'low',
    'Dharavi': 'high', 'Kurla': 'high', 'Powai': 'low',
    'Worli': 'medium', 'Thane': 'medium', 'Navi Mumbai': 'low',
  },
  'Delhi': {
    'Connaught Place': 'high', 'Lajpat Nagar': 'medium',
    'Saket': 'low', 'Dwarka': 'medium',
  },
  'Bengaluru': {
    'Koramangala': 'low', 'Indiranagar': 'low',
    'HSR Layout': 'low', 'Whitefield': 'medium', 'Electronic City': 'medium',
  },
  'Hyderabad': {
    'Gachibowli': 'low', 'HITEC City': 'low',
    'Banjara Hills': 'low', 'Secunderabad': 'medium',
  },
  'Pune': {
    'Koregaon Park': 'low', 'Hinjawadi': 'medium',
    'Kharadi': 'medium', 'Viman Nagar': 'low',
  },
  'Chennai': {
    'T. Nagar': 'medium', 'Anna Nagar': 'low',
    'Adyar': 'medium', 'Velachery': 'high', 'OMR': 'medium',
  },
  'Jaipur': {
    'Malviya Nagar': 'low', 'C-Scheme': 'low',
    'Vaishali Nagar': 'medium', 'Mansarovar': 'medium',
  },
  'Gurugram': {
    'Cyber City': 'low', 'DLF Phase 1-3': 'low', 'Sohna Road': 'medium',
  },
  'Noida': {
    'Sector 62': 'medium', 'Sector 18': 'medium', 'Greater Noida': 'high',
  },
};

function resolveWardRisk(city: string, zone: string): { wardResolved: boolean; riskTier: 'low' | 'medium' | 'high' } {
  const cityWards = WARD_RISK_MAP[city];
  if (cityWards && cityWards[zone]) {
    return { wardResolved: true, riskTier: cityWards[zone] };
  }
  // Fallback: city-level default
  const highRiskCities = ['Delhi', 'Chennai'];
  const mediumRiskCities = ['Mumbai', 'Noida', 'Gurugram'];
  if (highRiskCities.includes(city)) return { wardResolved: false, riskTier: 'high' };
  if (mediumRiskCities.includes(city)) return { wardResolved: false, riskTier: 'medium' };
  return { wardResolved: false, riskTier: 'low' };
}

/* ─── Adverse Selection Lock ─── */
// Known disaster windows where enrollment is locked (ISO date ranges)
const DISASTER_LOCK_WINDOWS: Array<{ city: string; start: string; end: string; reason: string }> = [
  // Example: Delhi AQI crisis Nov 2025
  { city: 'Delhi', start: '2025-11-01', end: '2025-11-15', reason: 'Delhi AQI Red Alert (Diwali Season)' },
  // Mumbai monsoon peak
  { city: 'Mumbai', start: '2025-07-15', end: '2025-08-15', reason: 'Mumbai Monsoon Peak' },
  // Chennai cyclone season
  { city: 'Chennai', start: '2025-11-20', end: '2025-12-10', reason: 'Chennai Cyclone Season' },
];

function checkAdverseSelectionLock(city: string, enrollmentDate?: string): { locked: boolean; reason: string } {
  const now = enrollmentDate ? new Date(enrollmentDate) : new Date();
  const dateStr = now.toISOString().slice(0, 10);
  
  for (const window of DISASTER_LOCK_WINDOWS) {
    if (city === window.city && dateStr >= window.start && dateStr <= window.end) {
      return { locked: true, reason: `Enrollment locked: ${window.reason}. Coverage effective after ${window.end}.` };
    }
  }
  
  return { locked: false, reason: '' };
}

/* ─── 48-Hour Cooling Period ─── */
// If a disaster was declared in the last 48 hours for a zone, new enrollments
// are held with a mandatory "cooling off" period (coverage starts 48hrs later).
function getCoolingPeriodWarning(city: string): string | null {
  // In production this would query the trigger_events DB.
  // For hackathon: we return null (no active cooling period).
  // This function is called by the underwriting flow and
  // would be wired to the CRON trigger_events table in production.
  const _city = city; // acknowledged
  return null;
}

export function underwriteWorker(input: UnderwritingInput): UnderwritingResult {
  const warnings: string[] = [];
  const steps: string[] = [];

  // DPDP Act 2023 Compliance Checks
  steps.push('DPDP Act 2023 Consent Verification');
  if (!input.dpdpConsents.gpsLocation || !input.dpdpConsents.bankUpi || !input.dpdpConsents.platformActivity) {
    return {
      eligible: false,
      reason: `Missing DPDP Act 2023 Consents. GPS, Bank, and Platform Activity tracking must be explicitly approved.`,
      activityTier: 'ineligible',
      cityPool: getCityPool(input.city),
      recommendedPlan: 'None',
      weeklyPremium: 0,
      maxPayoutPerWeek: 0,
      warnings: ['DPDP Act Consents Missing'],
      steps,
    };
  }

  // step 1: make sure they're on a supported platform
  steps.push('Platform verification');
  if (!ALLOWED_PLATFORMS.includes(input.platform)) {
    return {
      eligible: false,
      reason: `Platform "${input.platform}" is not supported. Supported: ${ALLOWED_PLATFORMS.join(', ')}`,
      activityTier: 'ineligible',
      cityPool: getCityPool(input.city),
      recommendedPlan: 'None',
      weeklyPremium: 0,
      maxPayoutPerWeek: 0,
      warnings: ['Unsupported gig platform'],
      steps,
    };
  }

  // Adverse Selection Lock — Block enrollment during known disaster windows
  steps.push('Adverse Selection Lock Check');
  const lockCheck = checkAdverseSelectionLock(input.city, input.enrollmentTimestamp);
  if (lockCheck.locked) {
    return {
      eligible: false,
      reason: lockCheck.reason,
      activityTier: 'ineligible',
      cityPool: getCityPool(input.city),
      recommendedPlan: 'None',
      weeklyPremium: 0,
      maxPayoutPerWeek: 0,
      warnings: ['Adverse Selection Protection Active'],
      steps,
    };
  }

  // 48-hour cooling period check
  const coolingWarning = getCoolingPeriodWarning(input.city);
  if (coolingWarning) {
    warnings.push(coolingWarning);
  }

  // Social Security Code 2020: 90/120-Day Engagement Rule
  steps.push('Social Security Code 2020 Eligibility');
  const requiredDays = input.isMultiApping ? 120 : 90;
  if (input.totalActiveDeliveryDays < requiredDays) {
    return {
      eligible: false,
      reason: `SS Code 2020 requires ${requiredDays} active days. Current: ${input.totalActiveDeliveryDays} days. Need ${requiredDays - input.totalActiveDeliveryDays} more days.`,
      activityTier: 'ineligible',
      cityPool: getCityPool(input.city),
      recommendedPlan: 'None',
      weeklyPremium: 0,
      maxPayoutPerWeek: 0,
      warnings: [`${requiredDays - input.totalActiveDeliveryDays} more active days needed for State ID eligibility`],
      steps,
    };
  }

  // Ward-level zone validation
  steps.push('Ward-level zone risk assessment');
  const wardResult = resolveWardRisk(input.city, input.zone);
  if (wardResult.riskTier === 'high') {
    warnings.push(`Zone "${input.zone}" is in a high-risk ward — premium may include risk surcharge.`);
  }

  // step 3: figure out which tier they fall into
  steps.push('Activity tier classification');
  const activityTier = classifyActivityTier(input.daysWorkedThisWeek, input.totalActiveDeliveryDays);

  // Workers with < 15 active days in last 30 → lower tier
  let adjustedTier = activityTier;
  if (input.daysActiveInLast30 < 15) {
    adjustedTier = 'basic';
    warnings.push('Low activity in last 30 days — assigned Basic tier');
  } else if (input.daysActiveInLast30 < 22) {
    if (adjustedTier === 'premium') adjustedTier = 'standard';
    warnings.push('Moderate activity — tier may be adjusted');
  }

  // step 4: assign their risk pool by city
  steps.push('City pool assignment');
  const cityPool = getCityPool(input.city);

  // step 5: match them with a plan
  steps.push('Plan recommendation');
  const tier = PREMIUM_TIERS[adjustedTier as keyof typeof PREMIUM_TIERS] || PREMIUM_TIERS.basic;
  const maxPayoutPerWeek = Math.round(input.avgWeeklyIncome * 0.50); // 50% max cap

  if (input.daysWorkedThisWeek < tier.minActivityDays) {
    warnings.push(`Current week activity (${input.daysWorkedThisWeek} days) is below tier requirement (${tier.minActivityDays} days). Coverage may be limited.`);
  }

  // Cost model breakdown
  steps.push('Cost model computation');
  const platformFeePercent = 5;      // 5% platform commission
  const operationalMarginPercent = 10; // 10% operational buffer
  const reinsurancePercent = 3;       // 3% reinsurance reserve
  const effectivePremiumToPool = tier.weeklyPremium * (1 - (platformFeePercent + operationalMarginPercent + reinsurancePercent) / 100);

  return {
    eligible: true,
    reason: `SS Code 2020 Eligible! Covered for ${tier.name}. ${input.totalActiveDeliveryDays} active days logged.`,
    activityTier: adjustedTier as 'basic' | 'standard' | 'premium',
    cityPool,
    recommendedPlan: tier.name,
    weeklyPremium: tier.weeklyPremium,
    maxPayoutPerWeek: Math.min(tier.maxPayoutPerWeek, maxPayoutPerWeek),
    warnings,
    steps,
    costModel: {
      platformFeePercent,
      operationalMarginPercent,
      reinsurancePercent,
      effectivePremiumToPool: parseFloat(effectivePremiumToPool.toFixed(2)),
    },
    wardValidation: {
      zone: input.zone,
      city: input.city,
      ...wardResult,
    },
  };
}
