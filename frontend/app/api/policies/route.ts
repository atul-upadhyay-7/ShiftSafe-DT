// GET /api/policies?workerId=...  — Get worker's policies
// POST /api/policies — not used (created during registration)
// PATCH /api/policies — update auto_renew status
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/backend/models/db';

interface PolicyRow {
  id: string;
  worker_id: string;
  plan_name: string;
  coverage_type: string;
  weekly_premium: number;
  max_coverage_per_week: number;
  coverage_events: string;
  status: string;
  start_date: string;
  end_date: string | null;
  auto_renew: number;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const workerId = req.nextUrl.searchParams.get('workerId');

  const db = getDb();

  let rows: PolicyRow[];
  if (workerId) {
    rows = db.prepare('SELECT * FROM policies WHERE worker_id = ? ORDER BY created_at DESC').all(workerId) as PolicyRow[];
  } else {
    rows = db.prepare('SELECT * FROM policies ORDER BY created_at DESC LIMIT 50').all() as PolicyRow[];
  }

  const policies = rows.map((r) => ({
    ...r,
    coverageEvents: JSON.parse(r.coverage_events),
    autoRenew: !!r.auto_renew,
  }));

  return NextResponse.json({ policies });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { policyId, autoRenew } = body;

    if (!policyId || autoRenew === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDb();
    
    const stmt = db.prepare('UPDATE policies SET auto_renew = ? WHERE id = ?');
    const result = stmt.run(autoRenew ? 1 : 0, policyId);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, policyId, autoRenew });
  } catch (error) {
    console.error('Failed to update policy:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
