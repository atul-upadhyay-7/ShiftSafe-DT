// handles new worker registration + auto-creates their first policy
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/backend/models/db';
import { calculateDynamicPremium } from '@/backend/engines/premium-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, email, platform, city, zone, shiftType, avgWeeklyIncome, vehicleType } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    // sanitize everything before touching the database
    const sanitizedName = String(name).trim().slice(0, 100);
    const sanitizedPhone = String(phone).replace(/\D/g, '');
    if (sanitizedPhone.length !== 10) {
      return NextResponse.json({ error: 'Phone must be exactly 10 digits' }, { status: 400 });
    }
    if (sanitizedName.length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
    }
    const ALLOWED_PLATFORMS = ['Zomato', 'Swiggy', 'Amazon Flex', 'Blinkit', 'Zepto'];
    const ALLOWED_ZONES = ['Andheri East', 'Andheri West', 'Bandra', 'Dharavi', 'Kurla', 'Powai', 'Worli', 'Thane', 'Navi Mumbai'];
    const safePlatform = ALLOWED_PLATFORMS.includes(platform) ? platform : 'Zomato';
    const safeZone = ALLOWED_ZONES.includes(zone) ? zone : 'Andheri West';
    const safeIncome = Math.max(500, Math.min(50000, Number(avgWeeklyIncome) || 4000));

    const workerId = crypto.randomUUID();
    const policyId = crypto.randomUUID();

    const db = getDb();

    // make sure this phone number isn't already taken
    const existing = db.prepare('SELECT id FROM workers WHERE phone = ?').get(sanitizedPhone);
    if (existing) {
      return NextResponse.json({ error: 'Phone number already registered' }, { status: 409 });
    }

    // save the worker record
    db.prepare(`INSERT INTO workers (id, name, phone, email, platform, city, zone, shift_type, avg_weekly_income, vehicle_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      workerId, sanitizedName, sanitizedPhone, email || null,
      safePlatform, city || 'Mumbai', safeZone,
      shiftType || 'full_day', safeIncome, vehicleType || 'bike'
    );

    // run the GBDT model to get their personalized premium
    const premium = await calculateDynamicPremium(
      safeIncome,
      safeZone,
      shiftType || 'full_day',
      0,
      'clear',
      safePlatform
    );

    // create their first active policy
    db.prepare(`INSERT INTO policies (id, worker_id, plan_name, weekly_premium, max_coverage_per_week, status)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      policyId, workerId, 'ShiftGuard Weekly', premium.finalPremium, 2000, 'active'
    );

    // save the full calculation for audit trail
    db.prepare(`INSERT INTO premium_calculations (id, worker_id, base_premium, zone_risk_factor, weather_risk_factor, historical_claim_factor, platform_risk_factor, final_premium, factors_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      crypto.randomUUID(), workerId, premium.basePremium,
      premium.factors.baseZoneRisk, premium.mlMetrics.weatherRiskVolatility,
      premium.factors.historicalClaims, premium.factors.platformStability,
      premium.finalPremium, JSON.stringify(premium)
    );

    return NextResponse.json({
      success: true,
      workerId,
      policyId,
      premium: {
        weekly: premium.finalPremium,
        breakdown: premium.breakdown,
        riskLevel: premium.riskLevel,
      },
    });
  } catch (err) {
    console.error('Registration error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
