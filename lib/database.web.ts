// In-memory storage for web
let webStorage: {
  outcome: string;
  activities: string[];
  logs: Record<string, Record<string, boolean>>;
  ratings: Record<string, number>;
  whoopToken: string | null;
  whoopData: Record<string, any>;
} = {
  outcome: '',
  activities: [],
  logs: {},
  ratings: {},
  whoopToken: null,
  whoopData: {},
};

// Tracks which rows came from "Generate sample data" rather than real user
// check-ins, so they can be told apart and removed later.
//
// Activity logs are keyed per (date, activity name) to match the granularity
// of database.native.ts, where is_synthetic lives on each activity_logs row.
// This was previously keyed by date alone, and logActivity dropped the whole
// date on any single toggle -- so ticking one box made that day's other
// synthetic rows permanently undeletable on web while native removed them.
// Same contract, two different outcomes.
const syntheticLogKeys = new Set<string>();
const syntheticRatingDates = new Set<string>();

const logKey = (date: string, activityName: string) => `${date}\u0000${activityName}`;

export const initDatabase = async () => {
};

export const saveSetup = async (outcome: string, activities: string[]) => {
  webStorage.outcome = outcome;
  webStorage.activities = activities;
};

export const getSetup = async (): Promise<{ outcome: string; activities: string[] } | null> => {
  if (!webStorage.outcome || webStorage.activities.length === 0) {
    return null;
  }
  return {
    outcome: webStorage.outcome,
    activities: webStorage.activities,
  };
};

export const logActivity = async (activityName: string, completed: boolean, date: string) => {
  if (!webStorage.logs[date]) {
    webStorage.logs[date] = {};
  }
  webStorage.logs[date][activityName] = completed;
  // Real, user-driven write: this one row is no longer synthetic. The rest of
  // the day's rows keep whatever status they had.
  syntheticLogKeys.delete(logKey(date, activityName));
};

export const getActivityLogs = async (date: string): Promise<Record<string, boolean>> => {
  return webStorage.logs[date] || {};
};

export const getAllActivityLogs = async (): Promise<Array<{
  date: string;
  activities: Record<string, boolean>;
}>> => {
  return Object.entries(webStorage.logs).map(([date, activities]) => ({
    date,
    activities,
  }));
};

export const getFullDataset = async (): Promise<Array<{
  date: string;
  activities: Record<string, boolean>;
  outcome: number | null;
}>> => {
  const allDates = new Set([
    ...Object.keys(webStorage.logs),
    ...Object.keys(webStorage.ratings),
  ]);

  return Array.from(allDates).map(date => ({
    date,
    activities: webStorage.logs[date] || {},
    outcome: webStorage.ratings[date] ?? null,
  })).sort((a, b) => b.date.localeCompare(a.date));
};

export const populateDummyData = async (
  data: Array<{ date: string; activities: Record<string, boolean>; outcome: number }>
): Promise<{ inserted: number; skipped: number }> => {
  let inserted = 0;
  let skipped = 0;

  for (const entry of data) {
    // Never overwrite a real check-in -- see the note in database.native.ts.
    // A date counts as real if it has data that was not written by a previous
    // populateDummyData call.
    const existingLog = webStorage.logs[entry.date];
    const hasRealLog =
      existingLog !== undefined &&
      Object.keys(existingLog).some(name => !syntheticLogKeys.has(logKey(entry.date, name)));
    const hasRealRating =
      webStorage.ratings[entry.date] !== undefined && !syntheticRatingDates.has(entry.date);
    if (hasRealLog || hasRealRating) {
      skipped += 1;
      continue;
    }

    webStorage.logs[entry.date] = { ...entry.activities };
    webStorage.ratings[entry.date] = entry.outcome;
    for (const activityName of Object.keys(entry.activities)) {
      syntheticLogKeys.add(logKey(entry.date, activityName));
    }
    syntheticRatingDates.add(entry.date);

    // Deliberately does NOT push into webStorage.activities. That array is the
    // user's saved setup (it drives the Track checklist), and appending
    // generated names to it made them permanent members of the user's own
    // activity list. getFullDataset derives its activity names from the logs,
    // so the analysis still sees them.
    inserted += 1;
  }

  return { inserted, skipped };
};

export const clearSyntheticData = async () => {
  for (const key of syntheticLogKeys) {
    const [date, activityName] = key.split('\u0000');
    const day = webStorage.logs[date];
    if (!day) continue;
    delete day[activityName];
    if (Object.keys(day).length === 0) {
      delete webStorage.logs[date];
    }
  }
  for (const date of syntheticRatingDates) {
    delete webStorage.ratings[date];
  }
  syntheticLogKeys.clear();
  syntheticRatingDates.clear();
};

export const logOutcomeRating = async (rating: number, date: string) => {
  webStorage.ratings[date] = rating;
  // Real, user-driven write: this date's rating is no longer synthetic.
  syntheticRatingDates.delete(date);
};

export const getOutcomeRating = async (date: string): Promise<number | null> => {
  return webStorage.ratings[date] || null;
};


export const saveWhoopToken = async (accessToken: string, refreshToken?: string) => {
  webStorage.whoopToken = accessToken;
};

export const getWhoopToken = async (): Promise<string | null> => {
  return webStorage.whoopToken;
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
  for (const entry of data) {
    webStorage.whoopData[entry.date] = entry;
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
  let results = Object.values(webStorage.whoopData);
  
  if (startDate) {
    results = results.filter((d: any) => d.date >= startDate);
  }
  if (endDate) {
    results = results.filter((d: any) => d.date <= endDate);
  }
  
  return results.sort((a: any, b: any) => b.date.localeCompare(a.date));
};
