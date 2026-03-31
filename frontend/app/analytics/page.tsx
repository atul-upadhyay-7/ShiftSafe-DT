'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/frontend/components/providers/AppProvider';

// Dynamic import for Chart.js (client-side only)
declare global {
  interface Window {
    Chart: any;
  }
}

function useChartJs() {
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => {
    if (window.Chart) { setLoaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);
  
  return loaded;
}

type ViewTab = 'worker' | 'admin';

const BREAKDOWN_ITEMS = [
  { key: 'weather', label: 'Weather Risk', color: '#4d9fff' },
  { key: 'zone', label: 'Zone Flood Risk', color: '#ff6b35' },
  { key: 'platform', label: 'Platform Outage', color: '#34d399' },
  { key: 'claims', label: 'Claims History', color: '#ff3b5c' },
];

export default function AnalyticsPage() {
  const router = useRouter();
  const { worker, policy, claims, totalEarningsProtected, isLoggedIn } = useAppState();
  const [tab, setTab] = useState<ViewTab>('worker');
  const chartLoaded = useChartJs();

  useEffect(() => {
    if (!isLoggedIn) router.replace('/');
  }, [isLoggedIn, router]);
  const barRef = useRef<HTMLCanvasElement>(null);
  const doughnutRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<any>(null);
  const doughnutChartRef = useRef<any>(null);

  const claimsByType = claims.reduce((acc, c) => {
    acc[c.triggerType] = (acc[c.triggerType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalPremiumPaid = policy?.totalPremiumPaid || (policy?.weeklyPremium || 28) * 2;
  const claimsCount = claims.length;

  // Bar chart for Worker View
  useEffect(() => {
    if (!chartLoaded || tab !== 'worker' || !barRef.current) return;
    
    if (barChartRef.current) barChartRef.current.destroy();
    
    const Chart = window.Chart;
    barChartRef.current = new Chart(barRef.current, {
      type: 'bar',
      data: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
        datasets: [
          {
            label: 'Premium Paid (₹)',
            data: [28, 28, 0, 28, 28, 28],
            backgroundColor: 'rgba(249, 115, 22, 0.7)',
            borderColor: '#f97316',
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: 'Claims Received (₹/10)',
            data: [0, 0, 205, 0, 147, 0],
            backgroundColor: 'rgba(77, 159, 255, 0.7)',
            borderColor: '#4d9fff',
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: { color: '#64748b', font: { size: 11 } },
          },
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          y: {
            ticks: { color: '#94a3b8', font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
        },
      },
    });
  }, [chartLoaded, tab]);

  // Doughnut chart for Admin View
  useEffect(() => {
    if (!chartLoaded || tab !== 'admin' || !doughnutRef.current) return;
    
    if (doughnutChartRef.current) doughnutChartRef.current.destroy();
    
    const Chart = window.Chart;
    const rainCount = claimsByType['heavy_rain'] || 1;
    const heatCount = claimsByType['heatwave'] || 1;
    const outageCount = claimsByType['platform_outage'] || 0;
    const pollCount = claimsByType['pollution'] || 0;

    doughnutChartRef.current = new Chart(doughnutRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Heavy Rain', 'Extreme Heat', 'Platform Outage', 'Pollution'],
        datasets: [{
          data: [rainCount, heatCount, outageCount, pollCount],
          backgroundColor: ['#34d399', '#ff6b35', '#4d9fff', '#a78bfa'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#64748b', font: { size: 11 }, padding: 15 },
          },
        },
      },
    });
  }, [chartLoaded, tab, claimsByType]);

  // Admin stats
  const activePolicies = 1;
  const lossRatio = totalEarningsProtected > 0
    ? Math.round((totalEarningsProtected / (totalPremiumPaid + 1)) * 100)
    : 0;

  const flaggedClaims = claims.filter(c => c.fraudScore > 40);

  return (
    <div className="space-y-5 max-w-[480px] mx-auto fade-in pb-8">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics</h1>

      {/* ─── Tab Toggle ─── */}
      <div className="flex p-1 rounded-xl bg-slate-100 border border-slate-200">
        <button
          onClick={() => setTab('worker')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            tab === 'worker' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          👤 Worker View
        </button>
        <button
          onClick={() => setTab('admin')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            tab === 'admin' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          🏢 Admin View
        </button>
      </div>

      {/* ─── WORKER VIEW ─── */}
      {tab === 'worker' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-4">
              <div className="text-xl font-bold text-emerald-500">₹{totalEarningsProtected.toLocaleString()}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Total Protected</div>
            </div>
            <div className="glass-card p-4">
              <div className="text-xl font-bold text-slate-900">{claimsCount}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Claims Paid</div>
            </div>
            <div className="glass-card p-4">
              <div className="text-xl font-bold text-primary-500">₹{totalPremiumPaid}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Premium Paid</div>
            </div>
            <div className="glass-card p-4">
              <div className="text-xl font-bold text-amber-500">{policy?.riskScore || 22}/100</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Risk Score</div>
            </div>
          </div>

          {/* Weekly Premium Breakdown */}
          <div className="glass-card p-5">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">Weekly Premium Breakdown</div>
            <div className="space-y-3">
              {BREAKDOWN_ITEMS.map(item => {
                const value = policy?.contributions?.[item.key as keyof typeof policy.contributions] ?? 25;
                return (
                  <div key={item.key} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ background: item.color }} />
                      <span className="text-xs text-slate-700">{item.label}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-900">{value}%</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <span className="text-[10px] text-emerald-600 font-mono font-semibold tracking-wider">
                AI MODEL — GBDT-v2.1 · Gradient Boosted Trees
              </span>
            </div>
          </div>

          {/* Monthly Coverage Chart */}
          <div className="glass-card p-5">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">Monthly Coverage Overview</div>
            <canvas ref={barRef} height="200" />
          </div>
        </>
      )}

      {/* ─── ADMIN VIEW ─── */}
      {tab === 'admin' && (
        <>
          {/* Portfolio Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-4">
              <div className="text-xl font-bold text-emerald-500">1</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Active Workers</div>
            </div>
            <div className="glass-card p-4">
              <div className="text-xl font-bold text-slate-900">{activePolicies}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Active Policies</div>
            </div>
            <div className="glass-card p-4">
              <div className="text-xl font-bold text-amber-500">{lossRatio}%</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Loss Ratio</div>
            </div>
            <div className="glass-card p-4">
              <div className="text-xl font-bold text-primary-500">₹{totalPremiumPaid}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Premium Collected</div>
            </div>
          </div>

          {/* Fraud Detection Queue */}
          <div className="glass-card p-5">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">Fraud Detection Queue</div>
            {flaggedClaims.length === 0 ? (
              <div className="text-sm text-emerald-600 font-medium py-2">
                ✅ No claims under review — AI cleared all recent claims
              </div>
            ) : (
              <div className="space-y-2">
                {flaggedClaims.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-red-100 bg-red-50">
                    <span className="text-lg">{c.triggerEmoji}</span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-900">{worker?.name || 'Worker'} — {c.triggerName}</div>
                      <div className="text-xs text-gray-500">Fraud Score: {c.fraudScore}/100</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-red-100 text-red-600 border border-red-200">
                      REVIEW
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trigger Analysis Chart */}
          <div className="glass-card p-5">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">Trigger Analysis</div>
            <canvas ref={doughnutRef} height="250" />
          </div>

          {/* Recent All Claims */}
          <div>
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">All Claims</div>
            <div className="space-y-2">
              {claims.map(c => (
                <div key={c.id} className="glass-card px-4 py-3 flex items-center gap-3">
                  <span className="text-lg">{c.triggerEmoji}</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900">{c.triggerName}</div>
                    <div className="text-[11px] text-gray-500">{c.relativeTime}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono" style={{ color: c.fraudColor }}>{c.fraudScore}/100</div>
                    <div className="text-sm font-bold text-emerald-500">₹{c.amount}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
