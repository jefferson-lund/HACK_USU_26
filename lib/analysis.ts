<<<<<<< HEAD
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
}

export const generateDummyData = (months: number = 6): CheckIn[] => {
  const data: CheckIn[] = [];
  const activities = ['Gym', 'Water', 'Meditation', 'Late Coffee', 'Sleep 8hrs'];
  const today = new Date();
  
  for (let i = months * 30; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Generate activity data with some patterns
    const gym = Math.random() > 0.6;
    const water = Math.random() > 0.4;
    const meditation = Math.random() > 0.7;
    const lateCoffee = Math.random() > 0.65;
    const sleep = Math.random() > 0.5;
    
    // Generate outcome with correlation to activities
    let outcome = 5;
    if (gym) outcome += 1.5;
    if (water) outcome += 0.8;
    if (meditation) outcome += 1.2;
    if (lateCoffee) outcome -= 0.9;
    if (sleep) outcome += 1.0;
    
    // Add noise
    outcome += (Math.random() - 0.5) * 2;
    outcome = Math.max(1, Math.min(10, Math.round(outcome)));
    
    data.push({
      date: dateStr,
      activities: {
        'Gym': gym,
        'Water': water,
        'Meditation': meditation,
        'Late Coffee': lateCoffee,
        'Sleep 8hrs': sleep,
      },
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

const classifyImpact = (coeff: number): ActivityImpact['impact'] => {
  if (coeff > 1.0) return 'strong positive';
  if (coeff > 0.3) return 'moderate positive';
  if (coeff < -1.0) return 'strong negative';
  if (coeff < -0.3) return 'moderate negative';
  return 'neutral';
};

export const getRegressionAnalysis = (data: CheckIn[], useLag: boolean = false): RegressionResult => {
  // Filter out entries without outcomes
  const validData = data.filter(d => d.outcome !== null && d.outcome !== undefined);
  
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
  
  for (let i = 0; i < validData.length; i++) {
    const current = validData[i];
    const outcomeIndex = useLag ? i + 1 : i;
    
    if (useLag && outcomeIndex >= validData.length) continue;
    
    const x = activityNames.map(name => current.activities[name] ? 1 : 0);
    const y = validData[outcomeIndex].outcome;
    
    alignedData.push({ x, y });
  }
  
  console.log('[Analysis] Aligned data length:', alignedData.length);
  console.log('[Analysis] Activity names:', activityNames);
  console.log('[Analysis] First 5 rows:', alignedData.slice(0, 5));
  console.log('[Analysis] Activity variance check:', activityNames.map((name, idx) => ({
    activity: name,
    sum: alignedData.reduce((sum, row) => sum + row.x[idx], 0),
    variance: alignedData.length > 0 ? alignedData.reduce((sum, row) => sum + row.x[idx], 0) / alignedData.length : 0
  })));
  
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
        impact: classifyImpact(correlation),
      };
    });
    
    return {
      impacts,
      r2: 0,
      sampleSize: alignedData.length,
      method: 'pearson-correlation',
    };
  }
  
  // Use multiple linear regression for larger samples
  const { MultivariateLinearRegression } = require('ml-regression');
  const X = alignedData.map(d => d.x);
  const Y = alignedData.map(d => [d.y]);
  
  console.log('[Analysis] Matrix X shape:', X.length, 'x', X[0]?.length);
  console.log('[Analysis] Matrix Y shape:', Y.length, 'x', Y[0]?.length);
  
  const regression = new MultivariateLinearRegression(X, Y);
  
  console.log('[Analysis] Regression weights:', regression.weights);
  console.log('[Analysis] Regression weights shape:', regression.weights.length, 'x', regression.weights[0]?.length);
  
  // MultivariateLinearRegression returns weights as [features x outputs]
  // For single output, we need the first column of each row
  const coefficients = regression.weights.map((row: number[]) => row[0]);
  
  console.log('[Analysis] Coefficients:', coefficients);
  console.log('[Analysis] Activity names:', activityNames);
  
  const impacts: ActivityImpact[] = activityNames.map((name, i) => ({
    activity: name,
    coefficient: coefficients[i] || 0,
    impact: classifyImpact(coefficients[i] || 0),
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
=======
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

const classifyImpact = (coeff: number): ActivityImpact['impact'] => {
  if (coeff > 1.0) return 'strong positive';
  if (coeff > 0.3) return 'moderate positive';
  if (coeff < -1.0) return 'strong negative';
  if (coeff < -0.3) return 'moderate negative';
  return 'neutral';
};

export const getRegressionAnalysis = (data: CheckIn[], useLag: boolean = false): RegressionResult => {
  // Filter out entries without outcomes
  const validData = data.filter(d => d.outcome !== null && d.outcome !== undefined);
  
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
  
  for (let i = 0; i < validData.length; i++) {
    const current = validData[i];
    const outcomeIndex = useLag ? i + 1 : i;
    
    if (useLag && outcomeIndex >= validData.length) continue;
    
    const x = activityNames.map(name => current.activities[name] ? 1 : 0);
    const y = validData[outcomeIndex].outcome;
    
    alignedData.push({ x, y });
  }
  
  console.log('[Analysis] Aligned data length:', alignedData.length);
  console.log('[Analysis] Activity names:', activityNames);
  console.log('[Analysis] First 5 rows:', alignedData.slice(0, 5));
  console.log('[Analysis] Activity variance check:', activityNames.map((name, idx) => ({
    activity: name,
    sum: alignedData.reduce((sum, row) => sum + row.x[idx], 0),
    variance: alignedData.length > 0 ? alignedData.reduce((sum, row) => sum + row.x[idx], 0) / alignedData.length : 0
  })));
  
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
        impact: classifyImpact(correlation),
      };
    });
    
    return {
      impacts,
      r2: 0,
      sampleSize: alignedData.length,
      method: 'pearson-correlation',
    };
  }
  
  // Use multiple linear regression for larger samples
  const { MultivariateLinearRegression } = require('ml-regression');
  const X = alignedData.map(d => d.x);
  const Y = alignedData.map(d => [d.y]);
  
  console.log('[Analysis] Matrix X shape:', X.length, 'x', X[0]?.length);
  console.log('[Analysis] Matrix Y shape:', Y.length, 'x', Y[0]?.length);
  
  const regression = new MultivariateLinearRegression(X, Y);
  
  console.log('[Analysis] Regression weights:', regression.weights);
  console.log('[Analysis] Regression weights shape:', regression.weights.length, 'x', regression.weights[0]?.length);
  
  // MultivariateLinearRegression returns weights as [features x outputs]
  // For single output, we need the first column of each row
  const coefficients = regression.weights.map((row: number[]) => row[0]);
  
  console.log('[Analysis] Coefficients:', coefficients);
  console.log('[Analysis] Activity names:', activityNames);
  
  const impacts: ActivityImpact[] = activityNames.map((name, i) => ({
    activity: name,
    coefficient: coefficients[i] || 0,
    impact: classifyImpact(coefficients[i] || 0),
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
  });
  
  const method = results.method === 'multiple-regression' 
    ? `Multiple Linear Regression (R² = ${results.r2.toFixed(2)})` 
    : 'Pearson Correlation';
  
  return `Analysis (${method}, n=${results.sampleSize}):\n${insights.join(', ')}. `;
};
>>>>>>> 52d92bb57d4bae6b811055a33e3ef1c622d519ea
