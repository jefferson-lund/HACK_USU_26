import * as Linking from 'expo-linking';
import { getApiBase } from '@/lib/apiBase';

// Not secret -- used client-side to build the WHOOP authorization URL.
const WHOOP_CLIENT_ID = process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID;
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v1';
const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';

// The redirect must be a URI the app itself owns so the OAuth deep-link
// listener in the active track screen can catch it. Linking.createURL builds the
// right scheme for both Expo Go and standalone builds (using app.json's
// "scheme"), so that's the default; EXPO_PUBLIC_WHOOP_REDIRECT_URI remains
// available as a manual override if it's ever needed.
const REDIRECT_URI = process.env.EXPO_PUBLIC_WHOOP_REDIRECT_URI || Linking.createURL('whoop-callback');

export function getWhoopAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: WHOOP_CLIENT_ID!,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'read:recovery read:cycles read:sleep read:workout read:profile',
  });
  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

// The client secret must never live in the app bundle (EXPO_PUBLIC_* vars are
// inlined into the shipped JS). The actual token exchange with WHOOP happens
// server-side at POST /api/whoop/token -- see server/index.js.
export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; refresh_token: string }> {
  const base = getApiBase();
  if (base === null) {
    throw new Error('Could not determine the backend URL. Set EXPO_PUBLIC_API_BASE_URL.');
  }

  const response = await fetch(`${base}/api/whoop/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange code for token');
  }

  return await response.json();
}

export interface WhoopCycle {
  id: string;
  start: string;
  end: string;
  score_state: string;
  score?: {
    strain: number;
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  };
}

export interface WhoopRecovery {
  cycle_id: string;
  sleep_id: string;
  score_state: string;
  score?: {
    user_calibrating: boolean;
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage: number;
    skin_temp_celsius: number;
  };
}

export interface WhoopSleep {
  id: string;
  start: string;
  end: string;
  score_state: string;
  score?: {
    stage_summary: {
      total_in_bed_time_milli: number;
      total_awake_time_milli: number;
      total_no_data_time_milli: number;
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
      sleep_cycle_count: number;
      disturbance_count: number;
    };
    sleep_needed: {
      baseline_milli: number;
      need_from_sleep_debt_milli: number;
      need_from_recent_strain_milli: number;
      need_from_recent_nap_milli: number;
    };
    respiratory_rate: number;
    sleep_performance_percentage: number;
    sleep_consistency_percentage: number;
    sleep_efficiency_percentage: number;
  };
}

export async function getWhoopAccessToken(authCode: string): Promise<string> {
  const data = await exchangeCodeForToken(authCode);
  return data.access_token;
}

export async function getWhoopCycles(accessToken: string, startDate: string, endDate: string): Promise<WhoopCycle[]> {
  const response = await fetch(
    `${WHOOP_API_BASE}/cycle?start=${startDate}&end=${endDate}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();
  return data.records || [];
}

export async function getWhoopRecovery(accessToken: string, startDate: string, endDate: string): Promise<WhoopRecovery[]> {
  const response = await fetch(
    `${WHOOP_API_BASE}/recovery?start=${startDate}&end=${endDate}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();
  return data.records || [];
}

export async function getWhoopSleep(accessToken: string, startDate: string, endDate: string): Promise<WhoopSleep[]> {
  const response = await fetch(
    `${WHOOP_API_BASE}/sleep?start=${startDate}&end=${endDate}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();
  return data.records || [];
}

export function formatWhoopDataForAnalysis(
  cycles: WhoopCycle[],
  recoveries: WhoopRecovery[],
  sleeps: WhoopSleep[]
) {
  const dataByDate: Record<string, any> = {};

  // Process cycles (strain data)
  cycles.forEach(cycle => {
    const date = cycle.start.split('T')[0];
    if (!dataByDate[date]) dataByDate[date] = { date };
    if (cycle.score) {
      dataByDate[date].strain = cycle.score.strain;
      dataByDate[date].avgHeartRate = cycle.score.average_heart_rate;
    }
  });

  // Process recovery
  recoveries.forEach(recovery => {
    const cycle = cycles.find(c => c.id === recovery.cycle_id);
    if (cycle && recovery.score) {
      const date = cycle.start.split('T')[0];
      if (!dataByDate[date]) dataByDate[date] = { date };
      dataByDate[date].recoveryScore = recovery.score.recovery_score;
      dataByDate[date].hrv = recovery.score.hrv_rmssd_milli;
      dataByDate[date].restingHR = recovery.score.resting_heart_rate;
    }
  });

  // Process sleep
  sleeps.forEach(sleep => {
    const date = sleep.start.split('T')[0];
    if (!dataByDate[date]) dataByDate[date] = { date };
    if (sleep.score) {
      dataByDate[date].sleepPerformance = sleep.score.sleep_performance_percentage;
      dataByDate[date].sleepDuration = Math.round(
        sleep.score.stage_summary.total_in_bed_time_milli / 1000 / 60 / 60 * 10
      ) / 10; // hours
    }
  });

  return Object.values(dataByDate);
}
