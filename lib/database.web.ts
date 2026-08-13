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

// Tracks which dates' logs/ratings came from "Generate 6 Months Dummy Data"
// rather than real user check-ins, so they can be told apart and removed
// later via clearSyntheticData(). Keyed by date since dummy data writes a
// whole day's activities/rating at once.
const syntheticLogDates = new Set<string>();
const syntheticRatingDates = new Set<string>();

export const initDatabase = async () => {
  console.log('Using in-memory storage for Web');
};

export const saveSetup = async (outcome: string, activities: string[]) => {
  console.log('Saving to web storage:', { outcome, activities });
  webStorage.outcome = outcome;
  webStorage.activities = activities;
};

export const getSetup = async (): Promise<{ outcome: string; activities: string[] } | null> => {
  console.log('Getting from web storage:', webStorage);
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
  // Real, user-driven write: this date's log is no longer (purely) synthetic.
  syntheticLogDates.delete(date);
  console.log('Logged activity:', { activityName, completed, date });
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
    outcome: webStorage.ratings[date] || null,
  })).sort((a, b) => b.date.localeCompare(a.date));
};

export const populateDummyData = async (data: Array<{ date: string; activities: Record<string, boolean>; outcome: number }>) => {
  console.log('[DB] Populating dummy data, first entry:', data[0]);
  console.log('[DB] First entry activities:', Object.keys(data[0].activities));
  
  for (const entry of data) {
    webStorage.logs[entry.date] = entry.activities;
    webStorage.ratings[entry.date] = entry.outcome;
    syntheticLogDates.add(entry.date);
    syntheticRatingDates.add(entry.date);

    // Add activities to the list if not present
    for (const activityName of Object.keys(entry.activities)) {
      if (!webStorage.activities.includes(activityName)) {
        webStorage.activities.push(activityName);
      }
    }
  }
  console.log('Populated dummy data:', data.length, 'entries');
  console.log('[DB] Sample ratings:', Object.entries(webStorage.ratings).slice(0, 3));
  console.log('[DB] Sample logs:', Object.entries(webStorage.logs).slice(0, 3));
  console.log('[DB] All activities in storage:', webStorage.activities);
};

export const clearSyntheticData = async () => {
  for (const date of syntheticLogDates) {
    delete webStorage.logs[date];
  }
  for (const date of syntheticRatingDates) {
    delete webStorage.ratings[date];
  }
  console.log('[DB] Cleared synthetic data:', {
    logDates: syntheticLogDates.size,
    ratingDates: syntheticRatingDates.size,
  });
  syntheticLogDates.clear();
  syntheticRatingDates.clear();
};

export const logOutcomeRating = async (rating: number, date: string) => {
  webStorage.ratings[date] = rating;
  // Real, user-driven write: this date's rating is no longer synthetic.
  syntheticRatingDates.delete(date);
  console.log('Logged outcome rating:', { rating, date });
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
