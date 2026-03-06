// PowerMonitorDB.js - Database manager for Tibber power monitoring
// Tracks hourly consumption, predictions, and monthly violations

// Utility function to safely convert Uint8Array to base64
function uint8ToBase64(uint8) {
  let CHUNK_SIZE = 0x8000; // 32k
  let index = 0;
  let length = uint8.length;
  let result = '';
  let slice;
  while (index < length) {
    slice = uint8.subarray(index, Math.min(index + CHUNK_SIZE, length));
    result += String.fromCharCode.apply(null, slice);
    index += CHUNK_SIZE;
  }
  return btoa(result);
}

// Save the database to localStorage
export const saveDatabaseToLocalStorage = (db) => {
  try {
    const binaryArray = db.export();
    const base64 = uint8ToBase64(new Uint8Array(binaryArray));
    localStorage.setItem('tibber-power-monitor-db', base64);
    console.log('Power monitor database saved to localStorage');
  } catch (error) {
    console.error('Error saving database:', error);
  }
};

// Helper to dynamically load sql-wasm.js from static files
export function loadSqlJsScript(src) {
  return new Promise((resolve, reject) => {
    if (window.initSqlJs) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

// Initialize database with schema
export const initializeDatabase = async () => {
  try {
    console.log('Initializing power monitor database...');
    const config = { locateFile: () => "/sql/sql-wasm.wasm" };
    await loadSqlJsScript("/sql/sql-wasm.js");
    const SQL = await window.initSqlJs(config);
    
    const savedDb = localStorage.getItem('tibber-power-monitor-db');
    let db;
    
    if (savedDb) {
      console.log('Loading existing power monitor database from localStorage');
      const binaryArray = new Uint8Array(atob(savedDb).split('').map(char => char.charCodeAt(0)));
      db = new SQL.Database(binaryArray);
    } else {
      console.log('Creating new power monitor database');
      db = new SQL.Database();
      
      // Table to track current hour state
      db.run(`CREATE TABLE IF NOT EXISTS hourly_tracking (
        hour_start INTEGER PRIMARY KEY,
        date TEXT NOT NULL,
        accumulated_at_start REAL NOT NULL,
        measurements_count INTEGER DEFAULT 0,
        max_projection REAL DEFAULT 0
      );`);
      
      // Table to track monthly violations (hours with avg > 10 kW)
      db.run(`CREATE TABLE IF NOT EXISTS monthly_violations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hour_start INTEGER NOT NULL,
        date TEXT NOT NULL,
        month TEXT NOT NULL,
        projected_avg REAL,
        actual_avg REAL,
        timestamp INTEGER NOT NULL
      );`);
      
      // Index for fast monthly queries
      db.run(`CREATE INDEX IF NOT EXISTS idx_month ON monthly_violations(month);`);
      
      saveDatabaseToLocalStorage(db);
    }
    
    return db;
  } catch (error) {
    console.error('Error initializing power monitor database:', error);
    throw error;
  }
};

// Get hour start data (for recovery after refresh)
export const getHourStartData = (db, hourStartTimestamp) => {
  try {
    const stmt = db.prepare('SELECT * FROM hourly_tracking WHERE hour_start = ?');
    stmt.bind([hourStartTimestamp]);
    
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  } catch (error) {
    console.error('Error getting hour start data:', error);
    return null;
  }
};

// Save or update hourly tracking data
export const saveHourlyData = (db, hourStartTimestamp, date, accumulatedAtStart, measurementsCount = 0, maxProjection = 0) => {
  try {
    // Use INSERT OR REPLACE to handle both new and existing records
    db.run(`INSERT OR REPLACE INTO hourly_tracking 
      (hour_start, date, accumulated_at_start, measurements_count, max_projection)
      VALUES (?, ?, ?, ?, ?)`,
      [hourStartTimestamp, date, accumulatedAtStart, measurementsCount, maxProjection]
    );
    saveDatabaseToLocalStorage(db);
  } catch (error) {
    console.error('Error saving hourly data:', error);
  }
};

// Update measurement count and max projection for current hour
export const updateHourlyStats = (db, hourStartTimestamp, measurementsCount, maxProjection) => {
  try {
    db.run(`UPDATE hourly_tracking 
      SET measurements_count = ?, max_projection = ?
      WHERE hour_start = ?`,
      [measurementsCount, maxProjection, hourStartTimestamp]
    );
  } catch (error) {
    console.error('Error updating hourly stats:', error);
  }
};

// Record a violation (hour with average > 10 kW)
export const recordViolation = (db, hourStartTimestamp, date, month, projectedAvg, actualAvg = null) => {
  try {
    const timestamp = Date.now();
    db.run(`INSERT INTO monthly_violations 
      (hour_start, date, month, projected_avg, actual_avg, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [hourStartTimestamp, date, month, projectedAvg, actualAvg, timestamp]
    );
    saveDatabaseToLocalStorage(db);
  } catch (error) {
    console.error('Error recording violation:', error);
  }
};

// Get violation count for current month
export const getCurrentMonthViolations = (db, month) => {
  try {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM monthly_violations WHERE month = ?');
    stmt.bind([month]);
    
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row.count || 0;
    }
    stmt.free();
    return 0;
  } catch (error) {
    console.error('Error getting monthly violations:', error);
    return 0;
  }
};

// Get all violations for a specific month
export const getMonthViolations = (db, month) => {
  try {
    const stmt = db.prepare(`SELECT * FROM monthly_violations 
      WHERE month = ? 
      ORDER BY hour_start DESC`);
    stmt.bind([month]);
    
    const violations = [];
    while (stmt.step()) {
      violations.push(stmt.getAsObject());
    }
    stmt.free();
    return violations;
  } catch (error) {
    console.error('Error getting month violations:', error);
    return [];
  }
};

// Clean old data (keep last N days)
export const cleanOldData = (db, daysToKeep = 60) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTimestamp = cutoffDate.getTime();
    
    // Clean old hourly tracking
    db.run('DELETE FROM hourly_tracking WHERE hour_start < ?', [cutoffTimestamp]);
    
    // Clean old violations
    db.run('DELETE FROM monthly_violations WHERE timestamp < ?', [cutoffTimestamp]);
    
    saveDatabaseToLocalStorage(db);
    console.log(`Cleaned data older than ${daysToKeep} days`);
  } catch (error) {
    console.error('Error cleaning old data:', error);
  }
};

// Clear all data (manual reset)
export const clearAllData = (db) => {
  try {
    db.run('DELETE FROM hourly_tracking');
    db.run('DELETE FROM monthly_violations');
    saveDatabaseToLocalStorage(db);
    console.log('All power monitor data cleared');
  } catch (error) {
    console.error('Error clearing data:', error);
  }
};

// Delete entire database
export const deleteDatabase = () => {
  try {
    localStorage.removeItem('tibber-power-monitor-db');
    console.log('Power monitor database deleted');
  } catch (error) {
    console.error('Error deleting database:', error);
  }
};
