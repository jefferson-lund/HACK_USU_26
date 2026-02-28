import * as SQLite from 'expo-sqlite';

let db: any = null;

export const initDatabase = async () => {
  if (!db) {
    db = SQLite.openDatabaseSync('tracker.db');
  }

  db.execSync(`
    CREATE TABLE IF NOT EXISTS setup (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outcome TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      completed INTEGER NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (activity_id) REFERENCES activities (id),
      UNIQUE(activity_id, date)
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS outcome_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rating INTEGER NOT NULL,
      date TEXT NOT NULL UNIQUE
    );
  `);
};

  db.execSync(`
    CREATE TABLE IF NOT EXISTS whoop_token (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS whoop_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      strain REAL,
      avg_heart_rate REAL,
      recovery_score REAL,
      hrv REAL,
      resting_hr REAL,
      sleep_performance REAL,
      sleep_duration REAL
    );
  `);
export const saveSetup = async (outcome: string, activities: string[]) => {
  if (!db) {
    db = SQLite.openDatabaseSync('tracker.db');
  }

  db.runSync('INSERT INTO setup (outcome) VALUES (?)', [outcome]);
  
  for (const activity of activities) {
    db.runSync('INSERT OR IGNORE INTO activities (name) VALUES (?)', [activity]);
  }
};

export const getSetup = async (): Promise<{ outcome: string; activities: string[] } | null> => {
  if (!db) {
    db = SQLite.openDatabaseSync('tracker.db');
  }

  const setup = db.getFirstSync<{ outcome: string }>('SELECT outcome FROM setup ORDER BY id DESC LIMIT 1');
  
  if (!setup) return null;

  const activities = db.getAllSync<{ name: string }>('SELECT name FROM activities');
  
  return {
    outcome: setup.outcome,
    activities: activities.map(a => a.name),
  };
};

export const logActivity = async (activityName: string, completed: boolean, date: string) => {
  if (!db) {
    db = SQLite.openDatabaseSync('tracker.db');
  }

  const activity = db.getFirstSync<{ id: number }>('SELECT id FROM activities WHERE name = ?', [activityName]);
  
  if (!activity) return;

  db.runSync(
    'INSERT OR REPLACE INTO activity_logs (activity_id, completed, date) VALUES (?, ?, ?)',
    [activity.id, completed ? 1 : 0, date]
  );
};

export const getActivityLogs = async (date: string): Promise<Record<string, boolean>> => {
  if (!db) {
    db = SQLite.openDatabaseSync('tracker.db');
  }

  const logs = db.getAllSync<{ name: string; completed: number }>(
    `SELECT a.name, al.completed 
     FROM activity_logs al 
     JOIN activities a ON al.activity_id = a.id 
     WHERE al.date = ?`,
    [date]
  );

  return logs.reduce((acc, log) => {
    acc[log.name] = log.completed === 1;
    return acc;
  }, {} as Record<string, boolean>);
};

export const logOutcomeRating = async (rating: number, date: string) => {
  if (!db) {
    db = SQLite.openDatabaseSync('tracker.db');
  }

  db.runSync(
    'INSERT OR REPLACE INTO outcome_ratings (rating, date) VALUES (?, ?)',
    [rating, date]
  );
};

export const getOutcomeRating = async (date: string): Promise<number | null> => {
  if (!db) {
    db = SQLite.openDatabaseSync('tracker.db');
  }

  const result = db.getFirstSync<{ rating: number }>(
    'SELECT rating FROM outcome_ratings WHERE date = ?',
    [date]
  );

  return result ? result.rating : null;
};

export const getAllActivityLogs = async (): Promise<Array<{
  date: string;
  activities: Record<string, boolean>;
}>> => {
  if (!db) {
    db = SQLite.openDatabaseSync('tracker.db');
  }

  const logs = db.getAllSync<{ date: string; name: string; completed: number }>(
    `SELECT al.date, a.name, al.completed 
     FROM activity_logs al 
     JOIN activities a ON al.activity_id = a.id 
     ORDER BY al.date DESC`
  );

  const grouped: Record<string, Record<string, boolean>> = {};
  
  for (const log of logs) {
    if (!grouped[log.date]) {
      grouped[log.date] = {};
    }
    grouped[log.date][log.name] = log.completed === 1;
  }

  return Object.entries(grouped).map(([date, activities]) => ({
    date,
    activities,
  }));
};

export const getFullDataset = async (): Promise<Array<{
  date: string;
  activities: Record<string, boolean>;
  outcome: number | null;
}>> => {
  if (!db) {
    db = SQLite.openDatabaseSync('tracker.db');
  }

  const logs = db.getAllSync<{ date: string; name: string; completed: number }>(
    `SELECT al.date, a.name, al.completed 
     FROM activity_logs al 
     JOIN activities a ON al.activity_id = a.id 
     ORDER BY al.date DESC`
  );

  const ratings = db.getAllSync<{ date: string; rating: number }>(
    'SELECT date, rating FROM outcome_ratings ORDER BY date DESC'
  );

  const ratingMap = new Map(ratings.map(r => [r.date, r.rating]));
  const grouped: Record<string, Record<string, boolean>> = {};
  
  for (const log of logs) {
    if (!grouped[log.date]) {
      grouped[log.date] = {};
    }
    grouped[log.date][log.name] = log.completed === 1;
  }

  const allDates = new Set([...Object.keys(grouped), ...ratings.map(r => r.date)]);

  return Array.from(allDates).map(date => ({
    date,
    activities: grouped[date] || {},
    outcome: ratingMap.get(date) || null,
  })).sort((a, b) => b.date.localeCompare(a.date));
};

export const populateDummyData = async (data: Array<{ date: string; activities: Record<string, boolean>; outcome: number }>) => {
  if (!db) {
    db = SQLite.openDatabaseSync('tracker.db');
  }

  for (const entry of data) {
    // Insert activities
    for (const [activityName, completed] of Object.entries(entry.activities)) {
      db.runSync('INSERT OR IGNORE INTO activities (name) VALUES (?)', [activityName]);
      
      const activity = db.getFirstSync<{ id: number }>(
        'SELECT id FROM activities WHERE name = ?',
        [activityName]
      );
      
      if (activity) {
        db.runSync(
          'INSERT OR REPLACE INTO activity_logs (activity_id, completed, date) VALUES (?, ?, ?)',
          [activity.id, completed ? 1 : 0, entry.date]
        );
      }
    }
    
    // Insert outcome rating
    db.runSync(
      'INSERT OR REPLACE INTO outcome_ratings (rating, date) VALUES (?, ?)',
      [entry.outcome, entry.date]
    );
  }
};

export const saveWhoopToken = async (accessToken: string, refreshToken?: string) => {
  if (!db) {
    db = SQLite.openDatabaseSync('tracker.db');
  }
  db.runSync(
    'INSERT OR REPLACE INTO whoop_token (id, access_token, refresh_token, updated_at) VALUES (1, ?, ?, CURRENT_TIMESTAMP)',
    [accessToken, refreshToken || null]
  );
};

export const getWhoopToken = async (): Promise<string | null> => {
  if (!db) {
    db = SQLite.openDatabaseSync('tracker.db');
  }
  const result = db.getFirstSync<{ access_token: string }>('SELECT access_token FROM whoop_token WHERE id = 1');
  return result?.access_token || null;
};

export const saveWhoopData = async (data: Array<{
  date: string;
  strain?: number;
  avgHeartRate?: number;
  recoveryScore?: number;
  hrv?: number;
  restingHR?: number;
  sleepPerformance?: number;
  sleepDuration?: number;
}>) => {
  if (!db) {
    db = SQLite.openDatabaseSync('tracker.db');
  }
  
  for (const entry of data) {
    db.runSync(
      `INSERT OR REPLACE INTO whoop_data 
       (date, strain, avg_heart_rate, recovery_score, hrv, resting_hr, sleep_performance, sleep_duration) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.date,
        entry.strain || null,
        entry.avgHeartRate || null,
        entry.recoveryScore || null,
        entry.hrv || null,
        entry.restingHR || null,
        entry.sleepPerformance || null,
        entry.sleepDuration || null,
      ]
    );
  }
};

export const getWhoopData = async (startDate?: string, endDate?: string): Promise<Array<{
  date: string;
  strain?: number;
  avgHeartRate?: number;
  recoveryScore?: number;
  hrv?: number;
  restingHR?: number;
  sleepPerformance?: number;
  sleepDuration?: number;
}>> => {
  if (!db) {
    db = SQLite.openDatabaseSync('tracker.db');
  }
  
  let query = 'SELECT * FROM whoop_data';
  const params: any[] = [];
  
  if (startDate && endDate) {
    query += ' WHERE date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  } else if (startDate) {
    query += ' WHERE date >= ?';
    params.push(startDate);
  } else if (endDate) {
    query += ' WHERE date <= ?';
    params.push(endDate);
  }
  
  query += ' ORDER BY date DESC';
  
  const results = db.getAllSync(query, params);
  return results.map((r: any) => ({
    date: r.date,
    strain: r.strain,
    avgHeartRate: r.avg_heart_rate,
    recoveryScore: r.recovery_score,
    hrv: r.hrv,
    restingHR: r.resting_hr,
    sleepPerformance: r.sleep_performance,
    sleepDuration: r.sleep_duration,
  }));
};
