'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/frontend/components/providers/AppProvider';
import { triggerNotification, triggerToast } from '@/frontend/components/ui/Notifications';
import { getTriggerEmoji, getTriggerName } from '@/backend/utils/store';

const SIMULATOR_BUTTONS = [
  { type: 'heavy_rain', emoji: '🌧️', label: 'Trigger Heavy Rain', desc: 'Simulates 67.5mm rainfall → auto-claim' },
  { type: 'heatwave', emoji: '🌡️', label: 'Trigger Extreme Heat', desc: 'Simulates 43.2°C → auto-claim' },
  { type: 'platform_outage', emoji: '📵', label: 'Trigger Platform Outage', desc: 'Simulates 95-min Zomato outage → auto-claim' },
  { type: 'pollution', emoji: '😷', label: 'Trigger Severe Pollution', desc: 'Simulates AQI 480 → auto-claim' },
];

const TRIGGER_DETAILS: Record<string, string> = {
  heavy_rain: '67.5mm in 2 hours · Threshold exceeded',
  heatwave: '43.2°C for 4+ hours · Threshold exceeded',
  pollution: 'AQI 480 · Hazardous level detected',
  platform_outage: '95-min Zomato outage · Service disruption',
};

export default function ClaimsPage() {
  const router = useRouter();
  const { worker, claims, simulateTrigger, isLoggedIn } = useAppState();
  const [processing, setProcessing] = useState<string | null>(null);
  const [fraudRunning, setFraudRunning] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) router.replace('/');
  }, [isLoggedIn, router]);

  const totalPaid = claims.reduce((s, c) => s + c.amount, 0);
  const approvedCount = claims.filter(c => c.status === 'paid').length;

  const handleSimulate = async (triggerType: string) => {
    if (processing) return;
    setProcessing(triggerType);

    const emoji = getTriggerEmoji(triggerType);
    const name = getTriggerName(triggerType);
    const earnings = worker?.avgWeeklyEarnings || 4200;
    const coveragePct: Record<string, number> = { heavy_rain: 0.70, heatwave: 0.50, pollution: 0.60, platform_outage: 0.80 };
    const amount = Math.round((earnings / 7) * (coveragePct[triggerType] ?? 0.50));

    // Step 1: Push notification
    triggerNotification({
      emoji,
      title: `${name} Detected — Claim Auto-Initiated`,
      subtitle: TRIGGER_DETAILS[triggerType] || 'Threshold exceeded',
      value: `₹${amount} to be credited`,
      amount,
    });

    // Step 2: Show fraud detection running
    await new Promise(r => setTimeout(r, 1000));
    setFraudRunning(true);

    // Step 3: Create claim after fraud check
    await new Promise(r => setTimeout(r, 1500));
    setFraudRunning(false);
    const claim = simulateTrigger(triggerType);

    // Step 4: Toast
    triggerToast(`₹${claim.amount} credited instantly via UPI ✓`, 'success');

    setProcessing(null);
  };

  return (
    <div className="space-y-5 max-w-[480px] mx-auto fade-in pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Claims</h1>
          <p className="text-sm text-gray-500">Zero-touch parametric payouts</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
          <span className="live-dot" />
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Auto-Processing</span>
        </div>
      </div>

      {/* summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4 text-center">
          <div className="text-xl font-bold text-slate-900">{claims.length}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Total Claims</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-xl font-bold text-emerald-500">₹{totalPaid.toLocaleString()}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Total Paid</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-xl font-bold text-slate-900">&lt;2s</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Avg. Time</div>
        </div>
      </div>

      {/* demo simulator */}
      <div className="glass-card p-5" style={{ borderColor: 'rgba(239, 68, 68, 0.15)' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">🔴 Live Demo — Simulate Trigger</h2>
        </div>

        <div className="space-y-2">
          {SIMULATOR_BUTTONS.map(btn => (
            <button
              key={btn.type}
              onClick={() => handleSimulate(btn.type)}
              disabled={processing !== null}
              className={`w-full glass-card px-4 py-3 flex items-center gap-3 text-left transition-all ${processing ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:border-primary-500/30 active:scale-[0.99]'}`}
            >
              <span className="text-xl">{btn.emoji}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900">{btn.label}</div>
                <div className="text-[11px] text-gray-500">{btn.desc}</div>
              </div>
              {processing === btn.type ? (
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-xs text-gray-400">▶</span>
              )}
            </button>
          ))}
        </div>

        {/* Fraud detection animation */}
        {fraudRunning && (
          <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-center fade-in">
            <div className="flex items-center justify-center gap-2 text-sm text-primary-500 font-semibold">
              <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              🤖 AI Fraud Detection running... Isolation Forest scoring...
            </div>
          </div>
        )}
      </div>

      {/* claims history */}
      <div>
        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Claims History</div>
        <div className="space-y-3">
          {claims.map((c) => (
            <div key={c.id} className="glass-card p-4 relative overflow-hidden">
              {/* Top row */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-orange-50 border border-slate-100 flex-shrink-0">
                  {c.triggerEmoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-slate-900">{c.triggerName}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                      c.status === 'paid' 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                        : 'bg-orange-50 text-orange-600 border border-orange-200'
                    }`}>
                      {c.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500">{c.relativeTime}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-emerald-500">₹{c.amount}</div>
                </div>
              </div>

              {/* Detail row (monospace) */}
              <div className="bg-slate-50 rounded-lg p-3 text-[11px] font-mono space-y-1.5 border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Trigger</span>
                  <span className="text-slate-800">{c.triggerValue}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Fraud Score</span>
                  <span style={{ color: c.fraudColor }} className="font-semibold">{c.fraudLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Payout Ref</span>
                  <span className="text-slate-800">{c.payoutRef}</span>
                </div>
                <div className="pt-1 border-t border-slate-100">
                  <span className="text-emerald-600 font-semibold">⚡ Zero-touch auto-initiated</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
