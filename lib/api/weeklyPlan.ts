import type { RegressionResult } from '@/lib/analysis';
import { getApiBase } from '@/lib/apiBase';

export interface WeeklyPlanDay {
  day_index: number;
  label: string;
  focus: string;
  activities: Array<{
    id: string;
    name: string;
    time_of_day: 'morning' | 'afternoon' | 'evening' | 'any';
    duration_minutes?: number;
    intensity?: 'low' | 'medium' | 'high';
    instructions: string;
    based_on_activity?: string;
    reason?: string;
  }>;
}

export interface WeeklyPlan {
  summary: string;
  rationale: string;
  guidelines: string[];
  days: WeeklyPlanDay[];
}

/**
 * Builds the payload expected by the /api/weekly-plan backend from regression results.
 */
export function buildWeeklyPlanPayload(
  outcomeGoal: string,
  regressionResult: RegressionResult,
  validData: Array<{ date: string; activities: Record<string, boolean>; outcome: number }>,
  options?: {
    time_constraints?: { max_minutes_per_day?: number; days_unavailable?: string[] };
    preferences?: Record<string, unknown>;
  }
): Record<string, unknown> {
  const avgOutcome =
    validData.length > 0
      ? validData.reduce((sum, d) => sum + d.outcome, 0) / validData.length
      : undefined;

  const activities = regressionResult.impacts.map((impact) => {
    const activityName = impact.activity;
    const completedCount = validData.filter(
      (d) => d.activities[activityName] === true
    ).length;
    const weeks = Math.max(1, validData.length / 7);
    const avgFreq = completedCount / weeks;

    return {
      name: activityName,
      description: activityName,
      coefficient: impact.coefficient,
      correlation: impact.coefficient,
      average_frequency_per_week: Math.round(avgFreq * 10) / 10,
      is_positive: impact.coefficient > 0.1,
      is_included_in_visualizations: Math.abs(impact.coefficient) >= 0.1,
    };
  });

  return {
    outcome_goal: outcomeGoal,
    current_average_outcome: avgOutcome,
    time_constraints: options?.time_constraints,
    preferences: options?.preferences,
    regression_summary: {
      r_squared: regressionResult.r2,
      n_days: regressionResult.sampleSize,
      activities,
    },
  };
}

/**
 * Calls the backend to generate a personalized 7-day plan from correlation analysis.
 */
export async function generateWeeklyPlan(payload: Record<string, unknown>): Promise<WeeklyPlan> {
  const base = getApiBase();
  if (base === null) {
    throw new Error('Could not determine the backend URL. Set EXPO_PUBLIC_API_BASE_URL.');
  }
  const url = `${base}/api/weekly-plan`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      const message = err.details || err.error || `Failed to generate plan: ${response.status}`;
      throw new Error(message);
    }

    return response.json();
  } catch (error) {
    console.error('[weeklyPlan] Fetch failed:', error);
    throw error;
  }
}
