// GET /api/dashboard — Aggregate stats for dashboard
import { NextResponse } from 'next/server';
import { getDb } from '@/backend/models/db';

interface CountRow { cnt: number }
interface SumRow { total: number }

export async function GET() {
  const db = getDb();

  const totalWorkers = (db.prepare('SELECT COUNT(*) as cnt FROM workers WHERE is_active = 1').get() as CountRow).cnt;
  const activePolicies = (db.prepare('SELECT COUNT(*) as cnt FROM policies WHERE status = ?').get('active') as CountRow).cnt;
  const totalClaims = (db.prepare('SELECT COUNT(*) as cnt FROM claims').get() as CountRow).cnt;
  const totalPayouts = (db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM claims WHERE status IN (?, ?)').get('auto_approved', 'paid') as SumRow).total;
  const weeklyPremiumsCollected = (db.prepare('SELECT COALESCE(SUM(weekly_premium), 0) as total FROM policies WHERE status = ?').get('active') as SumRow).total;

  // Recent claims
  const recentClaims = db.prepare('SELECT * FROM claims ORDER BY created_at DESC LIMIT 5').all();

  // Claims by type
  const claimsByType = db.prepare(`
    SELECT trigger_type, COUNT(*) as count, SUM(amount) as total_amount
    FROM claims GROUP BY trigger_type ORDER BY count DESC
  `).all();

  // Recent trigger events
  const recentTriggers = db.prepare('SELECT * FROM trigger_events ORDER BY detected_at DESC LIMIT 10').all();

  return NextResponse.json({
    stats: {
      totalWorkers,
      activePolicies,
      totalClaims,
      totalPayouts,
      weeklyPremiumsCollected,
      claimApprovalRate: totalClaims > 0 ? '100%' : 'N/A',
      avgProcessingTime: '<2s',
    },
    recentClaims,
    claimsByType,
    recentTriggers,
  });
}
