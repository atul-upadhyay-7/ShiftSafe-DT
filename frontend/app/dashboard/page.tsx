'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/frontend/components/providers/AppProvider';
import { triggerNotification, triggerToast } from '@/frontend/components/ui/Notifications';
import { getGreeting, formatIndianDate, getTriggerEmoji, getTriggerName } from '@/backend/utils/store';

const TRIGGERS = [
  { type: 'heavy_rain', emoji: '🌧️', name: 'Heavy Rain', value: '15mm/hr', safeLabel: 'Normal' },
  { type: 'heatwave', emoji: '🌡️', name: 'Extreme Heat', value: '30°C', safeLabel: 'Normal' },
  { type: 'pollution', emoji: '😷', name: 'Air Quality', value: 'AQI 120', safeLabel: 'Moderate' },
  { type: 'platform_outage', emoji: '📱', name: 'Platform Status', value: 'Online', safeLabel: 'Operational' },
  { type: 'zone_closure', emoji: '🚧', name: 'Zone Closures', value: 'None', safeLabel: 'Open' },
];

const WEATHER_PILLS = [
  { label: '🌡️ 30°C', color: '#f97316' },
  { label: '🌧️ 15mm', color: '#4d9fff' },
  { label: '😷 AQI 120', color: '#fbbf24' },
  { label: '💨 12 km/h', color: '#8892a4' },
];

const SIMULATOR_BUTTONS = [
  { type: 'heavy_rain', emoji: '🌧️', label: 'Trigger Heavy Rain', desc: 'Simulates 67.5mm rainfall → auto-claim', borderColor: 'border-blue-400/30', hoverBg: 'hover:bg-blue-50' },
  { type: 'heatwave', emoji: '🌡️', label: 'Trigger Extreme Heat', desc: 'Simulates 43.2°C → auto-claim', borderColor: 'border-orange-400/30', hoverBg: 'hover:bg-orange-50' },
  { type: 'platform_outage', emoji: '📵', label: 'Platform Outage', desc: 'Simulates 95-min outage → auto-claim', borderColor: 'border-red-400/30', hoverBg: 'hover:bg-red-50' },
  { type: 'pollution', emoji: '😷', label: 'Severe Pollution', desc: 'Simulates AQI 480 → auto-claim', borderColor: 'border-gray-400/30', hoverBg: 'hover:bg-gray-50' },
];

export default function DashboardPage() {
  const router = useRouter();
  const { worker, policy, claims, totalEarningsProtected, simulateTrigger, isLoggedIn } = useAppState();
  const [activeTriggers, setActiveTriggers] = useState<string[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  // redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn) router.replace('/');
  }, [isLoggedIn, router]);

  const riskScore = policy?.riskScore ?? 22;
  const riskColor = riskScore <= 25 ? '#34d399' : riskScore <= 50 ? '#4d9fff' : riskScore <= 75 ? '#ff6b35' : '#ff3b5c';
  const riskLabel = policy?.riskLabel ?? 'Low';

  const daysUntilRenewal = policy?.nextPaymentDue
    ? Math.max(0, Math.ceil((new Date(policy.nextPaymentDue).getTime() - Date.now()) / 86400000))
    : 3;

  const handleSimulate = async (triggerType: string) => {
    if (processing) return;
    setProcessing(triggerType);
    setActiveTriggers(prev => [...prev, triggerType]);

    const emoji = getTriggerEmoji(triggerType);
    const name = getTriggerName(triggerType);

    // Step 1: Show push notification
    const earnings = worker?.avgWeeklyEarnings || 4200;
    const coveragePct: Record<string, number> = { heavy_rain: 0.70, heatwave: 0.50, pollution: 0.60, platform_outage: 0.80 };
    const amount = Math.round((earnings / 7) * (coveragePct[triggerType] ?? 0.50));

    const TRIGGER_DETAILS: Record<string, string> = {
      heavy_rain: '67.5mm in 2 hours · Threshold exceeded',
      heatwave: '43.2°C for 4+ hours · Threshold exceeded',
      pollution: 'AQI 480 · Hazardous level detected',
      platform_outage: '95-min Zomato outage · Service disruption',
    };

    triggerNotification({
      emoji,
      title: `${name} Detected — Claim Auto-Initiated`,
      subtitle: TRIGGER_DETAILS[triggerType] || 'Threshold exceeded',
      value: `₹${amount} to be credited`,
      amount,
    });

    // Step 2: Wait 1s, then show processing
    await new Promise(r => setTimeout(r, 1000));

    // Step 3: Wait 1.5s more, then create claim
    await new Promise(r => setTimeout(r, 1500));
    const claim = simulateTrigger(triggerType);

    // Step 4: Show toast
    triggerToast(`₹${claim.amount} credited instantly via UPI ✓`, 'success');

    // Also try backend simulation (non-blocking)
    fetch('/api/triggers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulate: true, triggerType, severity: 'high', zone: worker?.zone || 'Andheri East' }),
    }).catch(() => {});

    // Reset after 5s
    setTimeout(() => {
      setActiveTriggers(prev => prev.filter(t => t !== triggerType));
    }, 5000);

    setProcessing(null);
  };

  const recentPaidClaims = claims.filter(c => c.status === 'paid').slice(0, 2);

  return (
    <div className="space-y-5 max-w-[480px] mx-auto fade-in pb-6">
      {/* ─── Greeting ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {getGreeting()}, {worker?.name?.split(' ')[0] || 'Ravi'} 👋
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{formatIndianDate(new Date())}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
          <span className="live-dot" />
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">LIVE</span>
        </div>
      </div>

      {/* ─── Coverage Shield Card ─── */}
      <div className="glass-card p-6 relative overflow-hidden card-accent-left-green" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.03)' }}>
        {/* Protected badge */}
        <div className="absolute top-4 right-4">
          <span className="badge-success inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Protected
          </span>
        </div>

        {/* Shield SVG */}
        <div className="flex justify-center mb-4 mt-2">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl relative"
            style={{ background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
            🛡️
            <div className="absolute inset-0 rounded-2xl animate-pulse" style={{ boxShadow: '0 0 20px rgba(16, 185, 129, 0.15)' }} />
          </div>
        </div>

        <div className="text-center mb-5">
          <div className="text-3xl font-extrabold text-slate-900">₹{policy?.coverageAmount?.toLocaleString() || '2,940'}</div>
          <div className="text-xs text-gray-500 mt-1">Income Loss Coverage</div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
          <div className="text-center">
            <div className="text-lg font-bold text-primary-500">₹{policy?.weeklyPremium || 28}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Weekly Premium</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-slate-900">{daysUntilRenewal}d</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Until Renewal</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-500">₹{totalEarningsProtected.toLocaleString()}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Protected</div>
          </div>
        </div>
      </div>

      {/* ─── Zone Risk Meter ─── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Zone Risk Meter</div>
          <span className="text-xs font-semibold text-slate-800">{worker?.zone || 'Andheri East'}</span>
        </div>

        {/* Risk bar */}
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${riskScore}%`, background: riskColor }}
          />
        </div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold" style={{ color: riskColor }}>{riskLabel} Risk</span>
          <span className="text-xs text-gray-500 font-mono">{riskScore}/100</span>
        </div>

        {/* Weather pills */}
        <div className="flex flex-wrap gap-2">
          {WEATHER_PILLS.map((pill, i) => (
            <span key={i} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white border border-slate-100 shadow-sm text-slate-700">
              {pill.label}
            </span>
          ))}
        </div>
      </div>

      {/* ─── Live Triggers ─── */}
      <div>
        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Live Triggers</div>
        <div className="space-y-2">
          {TRIGGERS.map(t => {
            const isActive = activeTriggers.includes(t.type);
            return (
              <div key={t.type} className="glass-card px-4 py-3 flex items-center gap-3">
                <span className="text-lg">{t.emoji}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                  <div className="text-[11px] text-gray-500">{isActive ? '⚠️ TRIGGERED' : t.value}</div>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Recent Payouts ─── */}
      {recentPaidClaims.length > 0 && (
        <div>
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Recent Payouts</div>
          <div className="space-y-2">
            {recentPaidClaims.map(c => (
              <div key={c.id} className="glass-card px-4 py-3 flex items-center gap-3">
                <span className="text-lg">{c.triggerEmoji}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900">{c.triggerName}</div>
                  <div className="text-[11px] text-gray-500">{c.relativeTime}</div>
                </div>
                <div className="text-sm font-bold text-emerald-500">₹{c.amount}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Demo Simulator ─── */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Live Demo — Simulate Trigger</h3>
        </div>

        <div className="space-y-2">
          {SIMULATOR_BUTTONS.map(btn => (
            <button
              key={btn.type}
              onClick={() => handleSimulate(btn.type)}
              disabled={processing !== null}
              className={`w-full glass-card px-4 py-3.5 flex items-center gap-3 text-left transition-all ${btn.borderColor} ${btn.hoverBg} ${processing ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-0.5 active:scale-[0.99]'}`}
            >
              <span className="text-xl">{btn.emoji}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900">{btn.label}</div>
                <div className="text-[11px] text-gray-500">{btn.desc}</div>
              </div>
              {processing === btn.type ? (
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-xs text-gray-400">→</span>
              )}
            </button>
          ))}
        </div>

        {/* Processing indicator */}
        {processing && (
          <div className="glass-card p-4 mt-3 text-center fade-in">
            <div className="flex items-center justify-center gap-2 text-sm text-primary-500 font-semibold">
              <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              🤖 AI Fraud Detection running... Isolation Forest scoring...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
