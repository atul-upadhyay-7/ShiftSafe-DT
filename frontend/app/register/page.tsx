'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/frontend/components/providers/AppProvider';
import { calculateWeeklyPremium } from '@/backend/engines/premium-engine';

type Step = 'phone' | 'otp' | 'profile' | 'calculating';

const ZONES = ['Andheri East', 'Bandra', 'Dharavi', 'Kurla', 'Powai', 'Worli', 'Thane', 'Navi Mumbai'];
const PLATFORMS = ['Zomato', 'Swiggy', 'Amazon Flex', 'Blinkit', 'Zepto'];

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAppState();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [form, setForm] = useState({
    name: '',
    platform: 'Zomato',
    zone: 'Andheri East',
    avgWeeklyEarnings: '',
    hoursPerDay: '',
    upiId: '',
  });

  const [premiumResult, setPremiumResult] = useState<ReturnType<typeof calculateWeeklyPremium> | null>(null);

  const update = (key: string, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  // Auto-focus first OTP box
  useEffect(() => {
    if (step === 'otp') {
      otpRefs.current[0]?.focus();
    }
  }, [step]);

  const handleSendOtp = () => {
    if (phone.length < 10) return;
    setStep('otp');
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setOtpError('');

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all filled
    if (newOtp.every(d => d !== '') && newOtp.join('') === '123456') {
      setTimeout(() => setStep('profile'), 300);
    } else if (newOtp.every(d => d !== '') && newOtp.join('') !== '123456') {
      setOtpError('Invalid OTP. Use demo OTP: 123456');
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleCalculatePremium = () => {
    setStep('calculating');
    const result = calculateWeeklyPremium(
      form.zone,
      parseFloat(form.avgWeeklyEarnings) || 4200,
      form.platform,
      0,
    );
    setPremiumResult(result);

    setTimeout(() => {
      // Login and navigate
      login(
        {
          id: `WRK-${Date.now()}`,
          name: form.name,
          phone,
          platform: form.platform,
          zone: form.zone,
          avgWeeklyEarnings: parseFloat(form.avgWeeklyEarnings) || 4200,
          hoursPerDay: parseInt(form.hoursPerDay) || 8,
          upiId: form.upiId,
        },
        {
          id: `POL-${Date.now()}`,
          weeklyPremium: result.weeklyPremium,
          coverageAmount: result.coverageAmount,
          riskScore: result.riskScore,
          riskLabel: result.riskLabel,
          status: 'active',
          startDate: new Date().toISOString().split('T')[0],
          nextPaymentDue: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          totalPremiumPaid: result.weeklyPremium,
          contributions: result.contributions,
        },
      );
      router.push('/dashboard');
    }, 2000);
  };

  // Also register to backend (non-blocking)
  useEffect(() => {
    if (step === 'calculating' && premiumResult) {
      fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone,
          platform: form.platform,
          city: 'Mumbai',
          zone: form.zone,
          shiftType: 'full_day',
          avgWeeklyIncome: parseFloat(form.avgWeeklyEarnings) || 4200,
          vehicleType: 'bike',
        }),
      }).catch(() => {}); // Non-blocking
    }
  }, [step, premiumResult, form, phone]);

  return (
    <div className="max-w-md mx-auto min-h-[75vh] flex flex-col items-center justify-center fade-in px-4">
      {/* ─── STEP 1: Phone Input ─── */}
      {step === 'phone' && (
        <div className="w-full">
          <div className="w-16 h-16 rounded-[1.25rem] mx-auto mb-6 flex items-center justify-center text-3xl shadow-lg"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
            <span style={{ transform: 'rotate(-15deg) scale(1.1)' }}>🛵</span>
          </div>
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">
              <span className="text-slate-900">Get </span>
              <span className="text-gradient-orange">Protected</span>
            </h1>
            <p className="text-sm text-gray-600">Enter your mobile number to get started</p>
          </div>

          <div>
            <label className="block text-[11px] font-bold tracking-widest text-gray-500 uppercase mb-2">Mobile Number</label>
            <div className="relative flex items-stretch bg-white border border-slate-200 rounded-xl focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/10 transition-all overflow-hidden shadow-sm">
              <div className="flex items-center px-4 bg-slate-50 border-r border-slate-200">
                <span className="text-gray-700 font-bold tracking-wide">+91</span>
              </div>
              <input
                className="flex-1 px-4 text-lg py-4 outline-none text-slate-900 bg-transparent placeholder-slate-400 font-medium"
                placeholder="9876543210"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                type="tel"
                maxLength={10}
              />
            </div>
          </div>

          <button
            onClick={handleSendOtp}
            disabled={phone.length < 10}
            className="btn btn-primary w-full text-lg font-bold py-4 rounded-xl mt-6 disabled:opacity-50"
          >
            Send OTP →
          </button>

          <p className="text-xs text-center text-gray-500 mt-6">
            By continuing, you agree to our <span className="text-primary-500 cursor-pointer">Terms</span> and <span className="text-primary-500 cursor-pointer">Privacy Policy</span>.
          </p>
        </div>
      )}

      {/* ─── STEP 2: OTP Verification ─── */}
      {step === 'otp' && (
        <div className="w-full">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl bg-primary-500/10 border border-primary-500/20">🔐</div>
            <h1 className="text-2xl font-extrabold tracking-tight mb-2 text-slate-900">Verify OTP</h1>
            <p className="text-sm text-gray-600">Sent to +91-{phone}</p>
          </div>

          <div className="flex justify-center gap-3 mb-4">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(i, e)}
                className="w-12 h-14 text-center text-xl font-bold rounded-xl border border-slate-200 bg-white text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
              />
            ))}
          </div>

          {otpError && (
            <div className="text-center text-sm text-red-500 font-medium mb-3">{otpError}</div>
          )}

          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-600">
              💡 Demo OTP: <span className="font-mono font-bold tracking-widest">123456</span>
            </div>
          </div>

          <button
            onClick={() => setStep('phone')}
            className="btn btn-ghost w-full mt-6 text-sm"
          >
            ← Change Number
          </button>
        </div>
      )}

      {/* ─── STEP 3: Profile Setup ─── */}
      {step === 'profile' && (
        <div className="w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-slate-900">Setup Profile</h1>
            <p className="text-sm text-gray-600">Tell us about your work to calculate your premium</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold tracking-widest text-gray-500 uppercase mb-1.5">Full Name</label>
              <input className="input-field" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Your full name" />
            </div>

            <div>
              <label className="block text-[11px] font-bold tracking-widest text-gray-500 uppercase mb-1.5">Platform</label>
              <select className="select-field" value={form.platform} onChange={e => update('platform', e.target.value)}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold tracking-widest text-gray-500 uppercase mb-1.5">Your Delivery Zone</label>
              <select className="select-field" value={form.zone} onChange={e => update('zone', e.target.value)}>
                {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold tracking-widest text-gray-500 uppercase mb-1.5">Average Weekly Earnings (₹)</label>
              <input className="input-field" type="number" value={form.avgWeeklyEarnings} onChange={e => update('avgWeeklyEarnings', e.target.value)} placeholder="4200" />
            </div>

            <div>
              <label className="block text-[11px] font-bold tracking-widest text-gray-500 uppercase mb-1.5">Hours Worked / Day</label>
              <input className="input-field" type="number" value={form.hoursPerDay} onChange={e => update('hoursPerDay', e.target.value)} placeholder="8" />
            </div>

            <div>
              <label className="block text-[11px] font-bold tracking-widest text-gray-500 uppercase mb-1.5">UPI ID (for payouts)</label>
              <input className="input-field" value={form.upiId} onChange={e => update('upiId', e.target.value)} placeholder="name@upi" />
            </div>
          </div>

          <button
            onClick={handleCalculatePremium}
            disabled={!form.name.trim() || !form.avgWeeklyEarnings || !form.hoursPerDay || !form.upiId.trim()}
            className="btn btn-primary w-full text-base font-bold py-4 rounded-xl mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Calculate My Premium →
          </button>
        </div>
      )}

      {/* ─── STEP 4: AI Calculating ─── */}
      {step === 'calculating' && (
        <div className="w-full text-center">
          <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center text-4xl bg-primary-500/10 border border-primary-500/20">
            🧠
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-3">AI Model calculating your risk profile...</h2>
          <p className="text-sm text-gray-600 mb-6">GBDT-v2.1 · Gradient Boosted Decision Tree</p>
          
          <div className="w-12 h-12 mx-auto border-3 border-primary-500 border-t-transparent rounded-full animate-spin mb-6" />

          {premiumResult && (
            <div className="glass-card p-5 text-left mt-4 fade-in">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Weekly Premium</div>
                  <div className="text-2xl font-bold text-primary-500">₹{premiumResult.weeklyPremium}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Coverage</div>
                  <div className="text-2xl font-bold text-slate-900">₹{premiumResult.coverageAmount}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                Risk Score: {premiumResult.riskScore}/100 · {premiumResult.riskLabel}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
