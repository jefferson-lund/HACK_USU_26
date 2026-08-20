export interface CheckIn {
  date: string;
  activities: Record<string, boolean>;
  outcome: number;
}

export interface ActivityImpact {
  activity: string;
  coefficient: number;
  impact: 'strong positive' | 'moderate positive' | 'neutral' | 'moderate negative' | 'strong negative';
}

export interface RegressionResult {
  impacts: ActivityImpact[];
  r2: number;
  sampleSize: number;
  method: 'multiple-regression' | 'pearson-correlation';
  predictions?: number[];
  actuals?: number[];
  /**
   * Date of the OUTCOME each aligned row predicts, in the same order as
   * `predictions`/`actuals`. Under `useLag` this is not the activity's own
   * date, so callers must use this rather than indexing their input array.
   */
  dates?: string[];
}

export const generateDummyData = (months: number = 6, userActivities: string[] = []): CheckIn[] => {
  const data: CheckIn[] = [];
  const activities = userActivities.length > 0 ? userActivities : ['Gym', 'Water', 'Meditation', 'Late Coffee', 'Sleep 8hrs'];
  const today = new Date();
  
  for (let i = months * 30; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Generate activity data with random patterns
    const activityRecord: Record<string, boolean> = {};
    activities.forEach((activity) => {
      activityRecord[activity] = Math.random() > 0.5;
    });
    
    // Generate outcome with correlation to activities
    let outcome = 5;
    activities.forEach((activity) => {
      if (activityRecord[activity]) {
        // Random impact between -1 and +1.5
        outcome += (Math.random() * 2.5) - 1;
      }
    });
    
    // Add noise
    outcome += (Math.random() - 0.5) * 2;
    outcome = Math.max(1, Math.min(10, Math.round(outcome)));
    
    data.push({
      date: dateStr,
      activities: activityRecord,
      outcome,
    });
  }
  
  return data;
};

const pearsonCorrelation = (x: number[], y: number[]): number => {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
};

const classifyImpact = (
  coeff: number,
  method: RegressionResult['method']
): ActivityImpact['impact'] => {
  if (method === 'pearson-correlation') {
    // Pearson's r is mathematically bounded to [-1, 1], so it needs its own,
    // tighter cutoffs — the >1.0 "strong" thresholds below can never fire
    // for a bounded coefficient.
    if (coeff > 0.7) return 'strong positive';
    if (coeff > 0.3) return 'moderate positive';
    if (coeff < -0.7) return 'strong negative';
    if (coeff < -0.3) return 'moderate negative';
    return 'neutral';
  }

  // Multiple-regression coefficients are unbounded, in outcome-point units.
  if (coeff > 1.0) return 'strong positive';
  if (coeff > 0.3) return 'moderate positive';
  if (coeff < -1.0) return 'strong negative';
  if (coeff < -0.3) return 'moderate negative';
  return 'neutral';
};

export const getRegressionAnalysis = (data: CheckIn[], useLag: boolean = false): RegressionResult => {
  // Filter out entries without outcomes, then sort oldest-first.
  //
  // The lag below pairs row i's activities with row i+1's outcome, which is
  // only "the next day" when the data runs oldest-first. getFullDataset()
  // returns rows newest-first, so without this sort `useLag` silently
  // correlated each day's activities with the PREVIOUS day's outcome --
  // reporting the opposite sign from the truth. Sorting here makes the result
  // correct no matter what order the caller passes.
  const validData = data
    .filter(d => d.outcome !== null && d.outcome !== undefined)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  
  if (validData.length === 0) {
    return {
      impacts: [],
      r2: 0,
      sampleSize: 0,
      method: 'pearson-correlation',
    };
  }
  
  // Extract unique activities
  const activityNames = Array.from(
    new Set(validData.flatMap(d => Object.keys(d.activities)))
  );
  
  if (activityNames.length === 0) {
    return {
      impacts: [],
      r2: 0,
      sampleSize: 0,
      method: 'pearson-correlation',
    };
  }
  
  // Build aligned dataset
  const alignedData: { x: number[]; y: number }[] = [];
  const alignedDates: string[] = [];
  
  for (let i = 0; i < validData.length; i++) {
    const current = validData[i];
    const outcomeIndex = useLag ? i + 1 : i;
    
    if (useLag && outcomeIndex >= validData.length) continue;
    
    const x = activityNames.map(name => current.activities[name] ? 1 : 0);
    const y = validData[outcomeIndex].outcome;
    
    alignedData.push({ x, y });
    alignedDates.push(validData[outcomeIndex].date);
  }
  
  if (alignedData.length === 0) {
    return {
      impacts: [],
      r2: 0,
      sampleSize: 0,
      method: 'pearson-correlation',
    };
  }
  
  if (alignedData.length < 10) {
    // Use Pearson correlation for small samples
    const impacts: ActivityImpact[] = activityNames.map(name => {
      const activityVector = alignedData.map(d => d.x[activityNames.indexOf(name)]);
      const outcomeVector = alignedData.map(d => d.y);
      const correlation = pearsonCorrelation(activityVector, outcomeVector);
      
      return {
        activity: name,
        coefficient: correlation,
        impact: classifyImpact(correlation, 'pearson-correlation'),
      };
    });
    
    return {
      impacts,
      r2: 0,
      sampleSize: alignedData.length,
      method: 'pearson-correlation',
      dates: alignedDates,
    };
  }
  
  // Use multiple linear regression for larger samples
  const { MultivariateLinearRegression } = require('ml-regression');
  const X = alignedData.map(d => d.x);
  const Y = alignedData.map(d => [d.y]);

  const regression = new MultivariateLinearRegression(X, Y);

  // MultivariateLinearRegression returns weights as [features x outputs]
  // For single output, we need the first column of each row
  const coefficients = regression.weights.map((row: number[]) => row[0]);

  const impacts: ActivityImpact[] = activityNames.map((name, i) => ({
    activity: name,
    coefficient: coefficients[i] || 0,
    impact: classifyImpact(coefficients[i] || 0, 'multiple-regression'),
  }));
  
  // Calculate R²
  const predictions = X.map(x => regression.predict(x)[0]);
  const actuals = Y.map(y => y[0]);
  const yMean = Y.reduce((sum, y) => sum + y[0], 0) / Y.length;
  const ssTotal = Y.reduce((sum, y) => sum + Math.pow(y[0] - yMean, 2), 0);
  const ssResidual = Y.reduce((sum, y, i) => sum + Math.pow(y[0] - predictions[i], 2), 0);
  const r2 = 1 - (ssResidual / ssTotal);
  
  return {
    impacts,
    r2,
    sampleSize: alignedData.length,
    method: 'multiple-regression',
    predictions,
    actuals,
    dates: alignedDates,
  };
};

export const generateInsightSummary = (results: RegressionResult): string => {
  if (results.impacts.length === 0) {
    return 'Not enough data to generate insights. Track activities for at least 10 days.';
  }
  
  const sorted = [...results.impacts].sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
  
  const insights = sorted.map(impact => {
    const coeff = impact.coefficient || 0;
    if (impact.impact === 'strong positive') {
      return `${impact.activity} has a strong positive impact (coeff: ${coeff.toFixed(2)})`;
    } else if (impact.impact === 'moderate positive') {
      return `${impact.activity} has a moderate positive impact (coeff: ${coeff.toFixed(2)})`;
    } else if (impact.impact === 'strong negative') {
      return `${impact.activity} has a strong negative impact (coeff: ${coeff.toFixed(2)})`;
    } else if (impact.impact === 'moderate negative') {
      return `${impact.activity} has a moderate negative impact (coeff: ${coeff.toFixed(2)})`;
    } else {
      return `${impact.activity} is currently neutral (coeff: ${coeff.toFixed(2)})`;
    }
  }).filter(Boolean);
  
  if (insights.length === 0) {
    return 'No significant activity impacts detected';
  }
  
  const method = results.method === 'multiple-regression' 
    ? `Multiple Linear Regression (R² = ${results.r2.toFixed(2)})` 
    : 'Pearson Correlation';
  
  return `Analysis (${method}, n=${results.sampleSize}):\n${insights.join(', ')}`;
};


export function enrichDataWithWhoop(
  activityData: CheckIn[],
  whoopData: Array<{
    date: string;
    strain?: number;
    recoveryScore?: number;
    hrv?: number;
    sleepPerformance?: number;
    sleepDuration?: number;
  }>
): CheckIn[] {
  const whoopByDate = new Map(whoopData.map(d => [d.date, d]));
  
  return activityData.map(entry => {
    const whoop = whoopByDate.get(entry.date);
    if (!whoop) return entry;
    
    const enrichedActivities = { ...entry.activities };
    
    // Add Whoop metrics as binary activities based on thresholds
    if (whoop.recoveryScore !== undefined) {
      enrichedActivities['High Recovery (>66%)'] = whoop.recoveryScore > 66;
    }
    if (whoop.sleepPerformance !== undefined) {
      enrichedActivities['Good Sleep (>85%)'] = whoop.sleepPerformance > 85;
    }
    if (whoop.strain !== undefined) {
      enrichedActivities['High Strain (>15)'] = whoop.strain > 15;
    }
    
    return {
      ...entry,
      activities: enrichedActivities,
    };
  });
}
