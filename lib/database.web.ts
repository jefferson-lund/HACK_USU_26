// In-memory storage for web
let webStorage: {
  outcome: string;
  activities: string[];
  logs: Record<string, Record<string, boolean>>;
  ratings: Record<string, number>;
} = {
  outcome: '',
  activities: [],
  logs: {},
  ratings: {},
};

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

export const logOutcomeRating = async (rating: number, date: string) => {
  webStorage.ratings[date] = rating;
  console.log('Logged outcome rating:', { rating, date });
};

export const getOutcomeRating = async (date: string): Promise<number | null> => {
  return webStorage.ratings[date] || null;
};
