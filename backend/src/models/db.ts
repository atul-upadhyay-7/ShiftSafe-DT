import Database from 'better-sqlite3';
import path from 'path';

// db lives right next to the running Next.js server
const DB_PATH = path.join(process.cwd(), 'shiftsafe.db');

// singleton so we don't open multiple connections
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      email TEXT,
      platform TEXT NOT NULL,
      city TEXT NOT NULL,
      zone TEXT NOT NULL,
      shift_type TEXT NOT NULL DEFAULT 'full_day',
      avg_weekly_income REAL DEFAULT 4000,
      vehicle_type TEXT DEFAULT 'bike',
      risk_score REAL DEFAULT 0.5,
      status TEXT DEFAULT 'active',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      plan_name TEXT DEFAULT 'ShiftGuard Basic',
      coverage_type TEXT DEFAULT 'weather_income_loss',
      weekly_premium REAL NOT NULL,
      max_coverage_per_week REAL DEFAULT 2000,
      coverage_events TEXT DEFAULT '["heavy_rain","heatwave","pollution","platform_outage","curfew"]',
      status TEXT DEFAULT 'active',
      start_date TEXT DEFAULT (date('now')),
      end_date TEXT,
      auto_renew INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    );

    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      policy_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_description TEXT,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'auto_approved',
      zone TEXT,
      payout_method TEXT DEFAULT 'UPI',
      evidence_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      processed_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (policy_id) REFERENCES policies(id),
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    );

    CREATE TABLE IF NOT EXISTS trigger_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      zone TEXT NOT NULL,
      city TEXT DEFAULT 'Mumbai',
      severity TEXT DEFAULT 'moderate',
      raw_data TEXT,
      source TEXT DEFAULT 'simulated',
      detected_at TEXT DEFAULT (datetime('now')),
      is_processed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS premium_history (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      amount REAL NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      status TEXT DEFAULT 'paid',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    );

    CREATE TABLE IF NOT EXISTS premium_calculations (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      base_premium REAL NOT NULL,
      zone_risk_factor REAL DEFAULT 0,
      weather_risk_factor REAL DEFAULT 0,
      historical_claim_factor REAL DEFAULT 0,
      platform_risk_factor REAL DEFAULT 0,
      final_premium REAL NOT NULL,
      factors_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    );
  `);
}

