/*
 * Fraud Detection Engine (Isolation Forest simulation)
 * Scores every claim 0-100 before approving payouts.
 * Rule-based checks + a random ML component for realism.
 */

interface FraudInput {
  distanceFromZone?: number;    // km
  claimAlreadyToday?: boolean;  // same event today?
  policyActive?: boolean;       // policy active at trigger time?
  claimAmount?: number;         // claimed amount
  dailyAverage?: number;        // avg daily earnings
  claimsLast30Days?: number;    // number of recent claims
}

interface FraudResult {
  score: number;
  decision: 'CLEAN' | 'LOW_RISK' | 'REVIEW' | 'BLOCKED';
  label: string;
  color: string;
  flags: string[];
  mlScore: number;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// run fraud checks on a claim before auto-approving
function detectFraud(input: FraudInput): FraudResult {
  const {
    distanceFromZone = 0.8,
    claimAlreadyToday = false,
    policyActive = true,
    claimAmount = 0,
    dailyAverage = 600,
    claimsLast30Days = 0,
  } = input;

  let score = 0;
  const flags: string[] = [];

  // --- Rule-based checks ---
  if (distanceFromZone > 5) {
    score += 35;
    flags.push('GPS_MISMATCH');
  }

  if (claimAlreadyToday) {
    score += 40;
    flags.push('DUPLICATE_CLAIM');
  }

  if (!policyActive) {
    score += 60;
    flags.push('RETROACTIVE_CLAIM');
  }

  if (dailyAverage > 0 && claimAmount > dailyAverage * 1.2) {
    score += 20;
    flags.push('AMOUNT_INFLATED');
  }

  if (claimsLast30Days > 3) {
    score += 25;
    flags.push('HIGH_FREQUENCY');
  }

  // Isolation Forest sim — adds randomness like a real ML model would
  // clean claims get a small bump (2-17 range), flagged ones already scored high
  const mlScore = Math.floor(Math.random() * 16) + 2;
  score += Math.round(mlScore * 0.35);

  score = clamp(Math.round(score), 0, 100);

  // map numerical score to human-readable decision
  let decision: FraudResult['decision'];
  let label: string;
  let color: string;

  if (score <= 19) {
    decision = 'CLEAN';
    label = `${score}/100 ✓ Clean`;
    color = '#34d399'; // green
  } else if (score <= 39) {
    decision = 'LOW_RISK';
    label = `${score}/100 Low Risk`;
    color = '#4d9fff'; // blue
  } else if (score <= 64) {
    decision = 'REVIEW';
    label = `${score}/100 ⚠ Review`;
    color = '#ff6b35'; // orange
  } else {
    decision = 'BLOCKED';
    label = `${score}/100 🚫 Blocked`;
    color = '#ff3b5c'; // red
  }

  return { score, decision, label, color, flags, mlScore };
}

// helper for the demo — simulates a clean claim from a real worker in their zone
export function detectFraudForDemo(claimsCount: number = 0): FraudResult {
  return detectFraud({
    distanceFromZone: 0.8,     // worker confirmed in zone
    claimAlreadyToday: false,
    policyActive: true,
    claimAmount: 0,            // normal range
    dailyAverage: 600,
    claimsLast30Days: claimsCount,
  });
}
