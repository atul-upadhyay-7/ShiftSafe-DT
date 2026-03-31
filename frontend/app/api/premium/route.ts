// GET /api/premium?workerId=...&zone=...&shift=...&forecast=...
import { NextRequest, NextResponse } from 'next/server';
import { calculateDynamicPremium } from '@/backend/engines/premium-engine';
import { getDb } from '@/backend/models/db';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const workerId = sp.get('workerId');
  const zone = sp.get('zone') || 'Andheri West';
  const shift = sp.get('shift') || 'full_day';
  const forecast = (sp.get('forecast') || 'clear') as 'clear' | 'light_rain' | 'heavy_rain' | 'storm';
  const income = parseFloat(sp.get('income') || '4000');

  let pastClaims = 0;
  if (workerId) {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as cnt FROM claims WHERE worker_id = ?').get(workerId) as { cnt: number } | undefined;
    pastClaims = row?.cnt || 0;
  }

  const result = await calculateDynamicPremium(income, zone, shift, pastClaims, forecast);

  return NextResponse.json(result);
}
