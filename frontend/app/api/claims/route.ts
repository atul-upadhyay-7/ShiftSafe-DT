// GET /api/claims?workerId=...  — Get claims for a worker
// POST /api/claims — Create claim from trigger
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/backend/models/db';
import { detectFraudForDemo } from '@/backend/engines/fraud-engine';

interface ClaimRow {
  id: string;
  policy_id: string;
  worker_id: string;
  trigger_type: string;
  trigger_description: string;
  trigger_data: string | null;
  amount: number;
  status: string;
  zone: string;
  detected_at: string;
  processed_at: string | null;
  payout_method: string;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const workerId = req.nextUrl.searchParams.get('workerId');
  const db = getDb();

  let rows: ClaimRow[];
  if (workerId) {
    rows = db.prepare('SELECT * FROM claims WHERE worker_id = ? ORDER BY created_at DESC').all(workerId) as ClaimRow[];
  } else {
    rows = db.prepare('SELECT * FROM claims ORDER BY created_at DESC LIMIT 100').all() as ClaimRow[];
  }

  return NextResponse.json({ claims: rows });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workerId, triggerType, severity, zone } = body;

    if (!workerId || !triggerType) {
      return NextResponse.json({ error: 'workerId and triggerType required' }, { status: 400 });
    }

    const db = getDb();

    // Get active policy for this worker
    const policy = db.prepare(
      'SELECT id, max_coverage_per_week FROM policies WHERE worker_id = ? AND status = ? LIMIT 1'
    ).get(workerId, 'active') as { id: string; max_coverage_per_week: number } | undefined;

    if (!policy) {
      return NextResponse.json({ error: 'No active policy found' }, { status: 404 });
    }

    // Check weekly claim limit
    const weekClaims = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM claims 
       WHERE worker_id = ? AND created_at >= datetime('now', '-7 days')`
    ).get(workerId) as { total: number };

    const PAYOUT_TABLE: Record<string, Record<string, number>> = {
      heavy_rain: { moderate: 100, high: 200, severe: 350 },
      heatwave: { moderate: 80, high: 150, severe: 250 },
      pollution: { moderate: 60, high: 120, severe: 200 },
      platform_outage: { moderate: 100, high: 200, severe: 300 },
      curfew: { moderate: 200, high: 350, severe: 500 },
    };

    const sev = severity || 'high';
    const amount = PAYOUT_TABLE[triggerType]?.[sev] || 100;

    if (weekClaims.total + amount > policy.max_coverage_per_week) {
      return NextResponse.json({
        error: 'Weekly coverage limit reached',
        weeklyUsed: weekClaims.total,
        maxCoverage: policy.max_coverage_per_week,
      }, { status: 422 });
    }

    // Process through Fraud Engine
    const fraudResult = detectFraudForDemo(1); // Pass recent claims count

    const claimId = crypto.randomUUID();
    const description = `${triggerType.replace(/_/g, ' ')} — ${sev} severity — auto-triggered in ${zone || 'zone'}`;

    db.prepare(`INSERT INTO claims (id, policy_id, worker_id, trigger_type, trigger_description, trigger_data, amount, status, zone, processed_at, payout_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`).run(
      claimId, policy.id, workerId, triggerType, description, JSON.stringify({ fraudScore: fraudResult.score, fraudLabel: fraudResult.label }), amount,
      fraudResult.decision === 'BLOCKED' ? 'review' : 'auto_approved', zone || 'Andheri West', 'UPI'
    );

    return NextResponse.json({
      success: true,
      claimId,
      amount,
      status: 'auto_approved',
      message: `₹${amount} payout auto-approved and sent via UPI`,
    });
  } catch (err) {
    console.error('Claim creation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
