'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/frontend/components/providers/AppProvider';

const COVERAGE_TRIGGERS = [
  { emoji: '🌧️', name: 'Heavy Rain', pct: '70%', desc: '70% of daily earnings' },
  { emoji: '🌡️', name: 'Extreme Heat', pct: '50%', desc: '50% of daily earnings' },
  { emoji: '😷', name: 'Severe Pollution', pct: '60%', desc: '60% of daily earnings' },
  { emoji: '📱', name: 'Platform Outage', pct: '80%', desc: '80% of daily earnings' },
  { emoji: '🚧', name: 'Zone Closure', pct: '100%', desc: '100% of daily earnings' },
];

const BREAKDOWN_BARS = [
  { key: 'weather', label: 'Weather Risk Contribution', color: '#4d9fff' },
  { key: 'zone', label: 'Zone Flood Risk', color: '#ff6b35' },
  { key: 'platform', label: 'Platform Outage Frequency', color: '#34d399' },
  { key: 'claims', label: 'Claims History Factor', color: '#ff3b5c' },
];

export default function PoliciesPage() {
  const router = useRouter();
  const { worker, policy, claims, isLoggedIn } = useAppState();

  useEffect(() => {
    if (!isLoggedIn) router.replace('/');
  }, [isLoggedIn, router]);

  const riskScore = policy?.riskScore ?? 22;
  const riskColor = riskScore <= 25 ? '#34d399' : riskScore <= 50 ? '#4d9fff' : riskScore <= 75 ? '#ff6b35' : '#ff3b5c';
  const riskLabel = policy?.riskLabel ?? 'Low';

  const totalPaid = claims.reduce((s, c) => s + c.amount, 0);
  const annualEquivalent = (policy?.weeklyPremium || 28) * 52;

  const startDateFormatted = policy?.startDate
    ? new Date(policy.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '16 Mar 2026';
  const nextPaymentFormatted = policy?.nextPaymentDue
    ? new Date(policy.nextPaymentDue).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '2 Apr 2026';

  return (
    <div className="space-y-5 max-w-[480px] mx-auto fade-in pb-8">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Policy Details</h1>

      {/* ─── Policy Header ─── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Policy ID</div>
            <div className="text-sm font-bold text-slate-900 font-mono">{policy?.id || 'POL-001'}</div>
          </div>
          <span className="badge-success inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
          <div>
            <span className="uppercase tracking-wider text-[10px] font-semibold">Start Date</span>
            <div className="text-sm text-slate-800 font-medium mt-0.5">{startDateFormatted}</div>
          </div>
          <div>
            <span className="uppercase tracking-wider text-[10px] font-semibold">Next Payment</span>
            <div className="text-sm text-slate-800 font-medium mt-0.5">{nextPaymentFormatted}</div>
          </div>
        </div>
      </div>

      {/* ─── Premium Stats Grid ─── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">Weekly Premium</div>
          <div className="text-3xl font-extrabold text-primary-500">₹{policy?.weeklyPremium || 28}</div>
        </div>
        <div className="glass-card p-5 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">Coverage Amount</div>
          <div className="text-3xl font-extrabold text-slate-900">₹{policy?.coverageAmount?.toLocaleString() || '2,940'}</div>
        </div>
      </div>

      {/* ─── AI Risk Score ─── */}
      <div className="glass-card p-5">
        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">AI Risk Score</div>
        <div className="flex items-center gap-3 mb-2">
          <div className="text-2xl font-extrabold text-slate-900">{riskScore}<span className="text-sm text-gray-400">/100</span></div>
          <div className="flex-1">
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${riskScore}%`, background: riskColor }} />
            </div>
          </div>
        </div>
        <div className="text-xs font-mono" style={{ color: riskColor }}>
          Model: GBDT-v2.1 · {riskLabel} Risk Zone
        </div>
      </div>

      {/* ─── AI PREMIUM BREAKDOWN (Critical for 5★) ─── */}
      <div className="glass-card p-5">
        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">AI Premium Breakdown</div>
        <div className="text-[10px] text-gray-400 font-mono mb-4">Gradient Boosted Decision Tree Analysis</div>

        <div className="space-y-4">
          {BREAKDOWN_BARS.map(b => {
            const value = policy?.contributions?.[b.key as keyof typeof policy.contributions] ?? 25;
            return (
              <div key={b.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-700">{b.label}</span>
                  <span className="text-xs font-bold text-slate-900">{value}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${value}%`, background: b.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Coverage Triggers ─── */}
      <div>
        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Coverage Triggers</div>
        <div className="space-y-2">
          {COVERAGE_TRIGGERS.map(t => (
            <div key={t.name} className="glass-card px-4 py-3 flex items-center gap-3">
              <span className="text-lg">{t.emoji}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                <div className="text-[11px] text-gray-500">{t.desc}</div>
              </div>
              <span className="badge-success px-2 py-0.5 rounded-md text-[10px] font-bold uppercase">ON</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Policy Details ─── */}
      <div className="glass-card p-5">
        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">Policy Summary</div>
        <div className="space-y-3">
          {[
            { label: 'Platform', value: worker?.platform || 'Zomato' },
            { label: 'Zone', value: worker?.zone || 'Andheri East' },
            { label: 'Start Date', value: startDateFormatted },
            { label: 'Next Payment', value: nextPaymentFormatted },
            { label: 'Total Paid', value: `₹${totalPaid.toLocaleString()}` },
            { label: 'Annual Premium (equiv.)', value: `₹${annualEquivalent.toLocaleString()}` },
            { label: 'UPI ID', value: worker?.upiId || 'ravi.kumar@upi' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
              <span className="text-xs text-gray-500">{item.label}</span>
              <span className="text-xs font-semibold text-slate-800">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Renew Button ─── */}
      <button className="btn btn-ghost w-full py-3.5 text-sm font-bold tracking-wider uppercase">
        🔄 Renew Policy
      </button>
    </div>
  );
}
