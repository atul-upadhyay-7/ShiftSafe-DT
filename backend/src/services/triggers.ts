// Trigger Monitoring Engine
// Checks external data sources for parametric trigger conditions

interface TriggerResult {
  triggered: boolean;
  type: string;
  severity: 'moderate' | 'high' | 'severe';
  description: string;
  rawData: Record<string, unknown>;
  payoutAmount: number;
  sourceApi: string;
}

// Payout table per trigger type
const PAYOUT_TABLE: Record<string, Record<string, number>> = {
  heavy_rain: { moderate: 100, high: 200, severe: 350 },
  heatwave: { moderate: 80, high: 150, severe: 250 },
  pollution: { moderate: 60, high: 120, severe: 200 },
  platform_outage: { moderate: 100, high: 200, severe: 300 },
  curfew: { moderate: 200, high: 350, severe: 500 },
};

// ──── WEATHER TRIGGER ────
export async function checkWeatherTrigger(
  lat: number = 19.076,
  lon: number = 72.8777,
): Promise<TriggerResult> {
  // Try real OpenWeatherMap API first, fall back to mock
  const apiKey = process.env.OPENWEATHER_API_KEY;
  
  if (apiKey && apiKey !== 'demo') {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
      );
      const data = await res.json();
      
      const rain1h = data.rain?.['1h'] || 0;
      const temp = data.main?.temp || 30;
      
      // Heavy rain trigger: >25mm in 1 hour (scaled; 50mm/2hr = 25mm/hr)
      if (rain1h > 25) {
        const severity = rain1h > 60 ? 'severe' : rain1h > 40 ? 'high' : 'moderate';
        return {
          triggered: true,
          type: 'heavy_rain',
          severity,
          description: `Heavy rainfall detected: ${rain1h.toFixed(1)}mm/hr in your zone`,
          rawData: { rainfall_mm: rain1h, temp, source: 'openweathermap' },
          payoutAmount: PAYOUT_TABLE.heavy_rain[severity],
          sourceApi: 'OpenWeatherMap',
        };
      }
      
      // Heatwave trigger: >42°C
      if (temp > 42) {
        const severity = temp > 47 ? 'severe' : temp > 45 ? 'high' : 'moderate';
        return {
          triggered: true,
          type: 'heatwave',
          severity,
          description: `Extreme heat alert: ${temp.toFixed(1)}°C in your zone`,
          rawData: { temp, humidity: data.main?.humidity, source: 'openweathermap' },
          payoutAmount: PAYOUT_TABLE.heatwave[severity],
          sourceApi: 'OpenWeatherMap',
        };
      }

      return {
        triggered: false,
        type: 'none',
        severity: 'moderate',
        description: `Weather normal: ${temp.toFixed(1)}°C, Rain: ${rain1h}mm/hr`,
        rawData: data,
        payoutAmount: 0,
        sourceApi: 'OpenWeatherMap',
      };
    } catch {
      // Fall through to mock
    }
  }
  
  // Mock weather data for demo
  return generateMockWeatherTrigger();
}

function generateMockWeatherTrigger(): TriggerResult {
  // Simulate occasional triggers for demo
  const rand = Math.random();
  if (rand < 0.3) {
    return {
      triggered: true,
      type: 'heavy_rain',
      severity: 'high',
      description: 'Heavy rainfall detected: 55mm/hr in Andheri West',
      rawData: { rainfall_mm: 55.2, temp: 28, humidity: 95, source: 'mock' },
      payoutAmount: PAYOUT_TABLE.heavy_rain.high,
      sourceApi: 'Mock (OpenWeatherMap)',
    };
  }
  return {
    triggered: false,
    type: 'none',
    severity: 'moderate',
    description: 'Weather normal: 31°C, Rain: 0mm/hr',
    rawData: { rainfall_mm: 0, temp: 31, humidity: 65, source: 'mock' },
    payoutAmount: 0,
    sourceApi: 'Mock (OpenWeatherMap)',
  };
}

// ──── AQI / POLLUTION TRIGGER ────
export async function checkPollutionTrigger(
  city: string = 'mumbai',
): Promise<TriggerResult> {
  const apiKey = process.env.AQICN_API_KEY;
  
  if (apiKey && apiKey !== 'demo') {
    try {
      const res = await fetch(
        `https://api.waqi.info/feed/${city}/?token=${apiKey}`
      );
      const data = await res.json();
      const aqi = data.data?.aqi || 0;
      
      if (aqi > 450) {
        const severity = aqi > 600 ? 'severe' : aqi > 500 ? 'high' : 'moderate';
        return {
          triggered: true,
          type: 'pollution',
          severity,
          description: `Severe air quality: AQI ${aqi} in ${city}`,
          rawData: { aqi, source: 'aqicn' },
          payoutAmount: PAYOUT_TABLE.pollution[severity],
          sourceApi: 'AQICN',
        };
      }
      
      return {
        triggered: false,
        type: 'none',
        severity: 'moderate',
        description: `Air quality acceptable: AQI ${aqi}`,
        rawData: { aqi, source: 'aqicn' },
        payoutAmount: 0,
        sourceApi: 'AQICN',
      };
    } catch {
      // Fall through to mock
    }
  }
  
  // Mock AQI data
  return {
    triggered: false,
    type: 'none',
    severity: 'moderate',
    description: 'Air quality moderate: AQI 128',
    rawData: { aqi: 128, source: 'mock' },
    payoutAmount: 0,
    sourceApi: 'Mock (AQICN)',
  };
}

// ──── PLATFORM OUTAGE TRIGGER ────
export async function checkPlatformOutageTrigger(): Promise<TriggerResult> {
  // In production, this would ping aggregator APIs or use Downdetector
  // For hackathon: mock with controllable probability
  const rand = Math.random();
  if (rand < 0.1) {
    return {
      triggered: true,
      type: 'platform_outage',
      severity: 'high',
      description: 'Zomato servers unreachable for 95+ minutes',
      rawData: { platform: 'Zomato', downtime_minutes: 97, source: 'mock' },
      payoutAmount: PAYOUT_TABLE.platform_outage.high,
      sourceApi: 'Platform Health Monitor',
    };
  }
  return {
    triggered: false,
    type: 'none',
    severity: 'moderate',
    description: 'All platforms operational',
    rawData: { platform: 'Zomato', status: 'up', source: 'mock' },
    payoutAmount: 0,
    sourceApi: 'Platform Health Monitor',
  };
}

// ──── MANUAL TRIGGER (for demo purposes) ────
export function simulateTrigger(
  type: 'heavy_rain' | 'heatwave' | 'pollution' | 'platform_outage' | 'curfew',
  severity: 'moderate' | 'high' | 'severe' = 'high',
): TriggerResult {
  const descriptions: Record<string, string> = {
    heavy_rain: `Heavy rainfall detected: ${severity === 'severe' ? '72' : severity === 'high' ? '55' : '35'}mm/hr in zone`,
    heatwave: `Extreme heat alert: ${severity === 'severe' ? '48' : severity === 'high' ? '45' : '43'}°C in zone`,
    pollution: `Severe AQI: ${severity === 'severe' ? '620' : severity === 'high' ? '510' : '470'} in zone`,
    platform_outage: `Platform down for ${severity === 'severe' ? '180' : severity === 'high' ? '120' : '95'} minutes`,
    curfew: `Section 144 imposed — zone locked for ${severity === 'severe' ? '24' : severity === 'high' ? '12' : '6'} hours`,
  };

  return {
    triggered: true,
    type,
    severity,
    description: descriptions[type],
    rawData: { simulated: true, type, severity },
    payoutAmount: PAYOUT_TABLE[type][severity],
    sourceApi: 'Manual Simulation',
  };
}
