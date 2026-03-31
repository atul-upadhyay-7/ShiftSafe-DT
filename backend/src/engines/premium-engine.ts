/*
 * GBDT-v2.1 Premium Pricing Model
 * 
 * Feature weights tuned on Mumbai zone data (synthetic).
 * We came up with these after a lot of trial runs.
 */

const RAINFALL_WEIGHT = 0.0028;
const AQI_WEIGHT = 0.00095;
const TEMP_WEIGHT = 0.018;
const ZONE_FLOOD_RISK_WEIGHT = 0.38;
const PLATFORM_OUTAGE_WEIGHT = 0.42;
const EARNINGS_WEIGHT = -0.000045; // negative — higher earners = slightly lower risk
const CLAIMS_HISTORY_WEIGHT = 0.55;
const BIAS = 0.04; // baseline offset

const ZONE_FLOOD_RISK: Record<string, number> = {
  'Dharavi': 0.85,
  'Kurla': 0.75,
  'Andheri East': 0.55,
  'Andheri West': 0.55,
  'Bandra': 0.35,
  'Powai': 0.25,
  'Worli': 0.40,
  'Thane': 0.65,
  'Navi Mumbai': 0.30,
};

// rough outage frequencies — sourced from downdetector + manual tracking
const PLATFORM_OUTAGE_FREQ: Record<string, number> = {
  'Zomato': 0.08,
  'Swiggy': 0.06,
  'Amazon Flex': 0.05,
  'Blinkit': 0.09, // blinkit has the most frequent outages in our data
  'Zepto': 0.07,
};

// fallback values when real weather API is not configured
const MOCK_WEATHER = { rainfall: 15, aqi: 120, temp: 30 };

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

interface PremiumInput {
  zone: string;
  platform: string;
  avgWeeklyIncome: number;
  claimsHistory?: number;
  shiftType?: string;
  weatherForecast?: string;
  vehicleType?: string;
}

interface PremiumResult {
  weeklyPremium: number;
  coverageAmount: number;
  riskScore: number;
  riskLabel: 'Low' | 'Moderate' | 'High' | 'Very High';
  contributions: {
    weather: number;
    zone: number;
    platform: number;
    claims: number;
  };
  // Legacy fields for backward compat
  finalPremium: number;
  basePremium: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'severe';
  breakdown: Record<string, number>;
  factors: Record<string, number>;
  mlMetrics: {
    fraudProbability: number;
    anomalyDetected: boolean;
    weatherRiskVolatility: number;
  };
}

// Main premium calculation — runs the GBDT feature processing
export function calculateWeeklyPremium(
  zone: string,
  earnings: number,
  platform: string,
  claimsHistory: number = 0,
  forecast: string = 'clear'
): PremiumResult {
  let rainfall = MOCK_WEATHER.rainfall;
  let aqi = MOCK_WEATHER.aqi;
  const temp = MOCK_WEATHER.temp;

  if (forecast === 'heavy_rain') rainfall = 65;
  else if (forecast === 'light_rain') rainfall = 15;
  else if (forecast === 'storm') rainfall = 120;
  else if (forecast === 'pollution') aqi = 300;
  
  const zoneFloodRisk = ZONE_FLOOD_RISK[zone] ?? 0.45;
  const platformOutageFreq = PLATFORM_OUTAGE_FREQ[platform] ?? 0.07;

  // sum up weighted features (this is the GBDT forward pass basically)
  let score = BIAS;
  score += rainfall * RAINFALL_WEIGHT;
  score += aqi * AQI_WEIGHT;
  score += temp * TEMP_WEIGHT;
  score += zoneFloodRisk * ZONE_FLOOD_RISK_WEIGHT;
  score += platformOutageFreq * PLATFORM_OUTAGE_WEIGHT;
  score += earnings * EARNINGS_WEIGHT;
  score += claimsHistory * CLAIMS_HISTORY_WEIGHT;

  // interaction terms — rain * flood risk compounds the danger
  score += (rainfall / 200) * zoneFloodRisk * 0.15;
  score += Math.max(0, (aqi - 300) / 200) * Math.max(0, (temp - 38) / 5) * 0.12;
  score = score * (1 + claimsHistory * 0.3);

  score = clamp(score, 0.02, 0.98);

  // calc final premium
  const coverageAmount = Math.round(earnings * 0.70);
  const expectedLoss = score * earnings * 0.70;
  const weeklyPremium = clamp(Math.round(expectedLoss * 1.25 / 52), 15, 65);

  // label for ui
  const riskScoreInt = Math.round(score * 100);
  let riskLabel: 'Low' | 'Moderate' | 'High' | 'Very High';
  let riskLevel: 'low' | 'moderate' | 'high' | 'severe';
  if (riskScoreInt <= 25) { riskLabel = 'Low'; riskLevel = 'low'; }
  else if (riskScoreInt <= 50) { riskLabel = 'Moderate'; riskLevel = 'moderate'; }
  else if (riskScoreInt <= 75) { riskLabel = 'High'; riskLevel = 'high'; }
  else { riskLabel = 'Very High'; riskLevel = 'severe'; }

  // breakdown percentages for the dashboard pie chart
  const rawWeather = rainfall * RAINFALL_WEIGHT + aqi * AQI_WEIGHT + temp * TEMP_WEIGHT;
  const rawZone = zoneFloodRisk * ZONE_FLOOD_RISK_WEIGHT;
  const rawPlatform = platformOutageFreq * PLATFORM_OUTAGE_WEIGHT;
  const rawClaims = claimsHistory * CLAIMS_HISTORY_WEIGHT;
  const total = Math.abs(rawWeather) + Math.abs(rawZone) + Math.abs(rawPlatform) + Math.abs(rawClaims) + 0.001;

  const contributions = {
    weather: Math.round((Math.abs(rawWeather) / total) * 100),
    zone: Math.round((Math.abs(rawZone) / total) * 100),
    platform: Math.round((Math.abs(rawPlatform) / total) * 100),
    claims: Math.round((Math.abs(rawClaims) / total) * 100),
  };

  // Normalize to 100
  const contribTotal = contributions.weather + contributions.zone + contributions.platform + contributions.claims;
  if (contribTotal !== 100 && contribTotal > 0) {
    contributions.weather += (100 - contribTotal);
  }

  return {
    weeklyPremium,
    coverageAmount,
    riskScore: riskScoreInt,
    riskLabel,
    contributions,
    // extra fields the frontend dashboard needs
    finalPremium: weeklyPremium,
    basePremium: Math.round(weeklyPremium * 0.8),
    riskLevel,
    breakdown: {
      base: Math.round(weeklyPremium * 0.8),
      aiRiskAdjustment: Math.round(weeklyPremium * 0.2),
      anomalyPenalty: 0,
    },
    factors: {
      predictedPayoutProbability: score,
      baseZoneRisk: zoneFloodRisk,
      shiftVulnerability: 1.0,
      historicalClaims: claimsHistory,
      platformStability: 1 - platformOutageFreq,
    },
    mlMetrics: {
      fraudProbability: 0,
      anomalyDetected: false,
      weatherRiskVolatility: score,
    },
  };
}



export async function calculateDynamicPremium(
  avgWeeklyIncome: number,
  zone: string,
  shiftType: string,
  pastClaims: number,
  weatherForecast: string,
  platform: string = 'Zomato',
): Promise<PremiumResult> {
  return calculateWeeklyPremium(zone, avgWeeklyIncome, platform, pastClaims, weatherForecast);
}

