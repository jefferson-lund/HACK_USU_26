import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

import { Text, View } from '@/components/Themed';
import { generateDummyData, generateInsightSummary, getRegressionAnalysis, enrichDataWithWhoop } from '@/lib/analysis';
import { getActivityLogs, getFullDataset, getOutcomeRating, getSetup, initDatabase, logActivity, logOutcomeRating, populateDummyData, saveWhoopToken, getWhoopToken, saveWhoopData, getWhoopData } from '@/lib/database';
import { exchangeCodeForToken, formatWhoopDataForAnalysis, getWhoopAuthUrl, getWhoopCycles, getWhoopRecovery, getWhoopSleep } from '@/lib/whoop';
import { buildWeeklyPlanPayload, generateWeeklyPlan, type WeeklyPlan } from '@/lib/api/weeklyPlan';
import ImpactChart from '@/components/ImpactChart';
import BeakerIcon from '@/components/BeakerIcon';
import LaserDinosaur from '@/components/LaserDinosaur';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

export default function TrackScreen() {
  const [activities, setActivities] = useState<string[]>([]);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [insights, setInsights] = useState('');
  const [tapCount, setTapCount] = useState(0);
  const [showDinos, setShowDinos] = useState(false);
  
  // Safety wrapper to prevent rendering invalid text nodes
  const safeSetInsights = (value: string) => {
    const cleaned = value?.trim();
    if (!cleaned || cleaned === '.' || cleaned.length === 0) {
      setInsights('');
    } else {
      setInsights(cleaned);
    }
  };
  const [dataPreview, setDataPreview] = useState<Array<{ date: string; activities: Record<string, boolean>; outcome: number }>>([]);
  const [regressionResults, setRegressionResults] = useState<any>(null);
  const [scatterData, setScatterData] = useState<Array<{ x: number; y: number; predicted: number; date: string }>>([]);
  const [whoopData, setWhoopData] = useState<any[]>([]);
  const [whoopToken, setWhoopToken] = useState<string>('');
  const [isLoadingWhoop, setIsLoadingWhoop] = useState(false);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  
  // Safety wrapper to prevent rendering invalid text nodes
  const safeSetPlanError = (value: string | null) => {
    if (!value) {
      setPlanError(null);
      return;
    }
    const cleaned = value.trim();
    if (!cleaned || cleaned === '.' || cleaned.length < 2) {
      setPlanError('An error occurred');
    } else {
      setPlanError(cleaned);
    }
  };
  const [validDataForPlan, setValidDataForPlan] = useState<Array<{ date: string; activities: Record<string, boolean>; outcome: number }>>([]);
  const today = new Date().toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    console.log('Loading track data...');
    await initDatabase();
    const setup = await getSetup();
    console.log('Setup loaded:', setup);
    if (setup) {
      setActivities(setup.activities);
      setOutcome(setup.outcome);
      const logs = await getActivityLogs(today);
      setCompleted(logs);
      const savedRating = await getOutcomeRating(today);
      setRating(savedRating);
    }
    
    // Restore Whoop token
    const token = await getWhoopToken();
    if (token) {
      setWhoopToken(token);
    }
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    // Handle OAuth redirect
    const handleDeepLink = async (event: { url: string }) => {
      const { queryParams } = Linking.parse(event.url);
      if (queryParams?.code) {
        try {
          const { access_token, refresh_token } = await exchangeCodeForToken(queryParams.code as string);
          setWhoopToken(access_token);
          await saveWhoopToken(access_token, refresh_token);
          alert('Successfully connected to Whoop!');
          // Automatically fetch data
          await handleFetchWhoopDataWithToken(access_token);
        } catch (error) {
          console.error('OAuth error:', error);
          alert('Failed to connect to Whoop');
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  const toggleActivity = async (activity: string) => {
    const newValue = !completed[activity];
    setCompleted(prev => ({ ...prev, [activity]: newValue }));
    await logActivity(activity, newValue, today);
  };

  const handleRatingSelect = async (value: number) => {
    setRating(value);
    await logOutcomeRating(value, today);
    
    // Auto-refresh plan if one exists
    if (weeklyPlan && regressionResults) {
      setTimeout(() => handleGeneratePlan(), 1000);
    }
  };

  const handlePopulateDummyData = async () => {
    const dummyData = generateDummyData(6, activities);
    await populateDummyData(dummyData);
    alert('Populated 6 months of dummy data!');
    loadData();
  };

  const handleConnectWhoop = async () => {
    try {
      const authUrl = getWhoopAuthUrl();
      await WebBrowser.openAuthSessionAsync(authUrl);
    } catch (error) {
      console.error('Error opening Whoop auth:', error);
      alert('Failed to open Whoop authorization');
    }
  };

  const handleFetchWhoopDataWithToken = async (token: string) => {
    setIsLoadingWhoop(true);
    try {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

      const [cycles, recoveries, sleeps] = await Promise.all([
        getWhoopCycles(token, startDate, endDate),
        getWhoopRecovery(token, startDate, endDate),
        getWhoopSleep(token, startDate, endDate),
      ]);

      const formattedData = formatWhoopDataForAnalysis(cycles, recoveries, sleeps);
      setWhoopData(formattedData);
      
      // Save to database
      await saveWhoopData(formattedData);
      
      alert(`Fetched and saved ${formattedData.length} days of Whoop data!`);
    } catch (error) {
      console.error('Error fetching Whoop data:', error);
      alert('Failed to fetch Whoop data.');
    } finally {
      setIsLoadingWhoop(false);
    }
  };

  const handleFetchWhoopData = async () => {
    if (!whoopToken) {
      alert('Please connect to Whoop first');
      return;
    }
    await handleFetchWhoopDataWithToken(whoopToken);
  };

  const handleRunAnalysis = async () => {
    const dataset = await getFullDataset();
    console.log('[Track] Full dataset:', dataset.slice(0, 3));
    
    let validData = dataset
      .filter(d => d.outcome !== null && d.outcome !== undefined)
      .map(d => ({
        date: d.date,
        activities: d.activities,
        outcome: d.outcome as number,
      }));
    
    // Enrich with Whoop data if available
    const whoopData = await getWhoopData();
    if (whoopData.length > 0) {
      console.log('[Track] Enriching with Whoop data:', whoopData.length, 'entries');
      validData = enrichDataWithWhoop(validData, whoopData);
    }
    
    console.log('[Track] Valid data:', validData.slice(0, 3));
    setDataPreview(validData.slice(0, 10)); // Show last 10 days
    
    const results = getRegressionAnalysis(validData, false);
    setRegressionResults(results);
    setValidDataForPlan(validData);
    
    // Prepare scatter plot data with dates
    if (results.predictions && results.actuals) {
      const scatter = results.actuals.map((actual, i) => ({
        x: actual,
        y: results.predictions![i],
        predicted: results.predictions![i],
        date: validData[i].date,
      }));
      setScatterData(scatter);
    }
    
    const summary = generateInsightSummary(results);
    console.log('[Track] Setting insights:', JSON.stringify(summary.substring(0, 100)));
    safeSetInsights(summary);
    setWeeklyPlan(null);
    safeSetPlanError(null);
  };

  const handleGeneratePlan = async () => {
    if (!regressionResults || !outcome || validDataForPlan.length === 0) return;
    setPlanLoading(true);
    safeSetPlanError(null);
    try {
      const payload = buildWeeklyPlanPayload(outcome, regressionResults, validDataForPlan);
      const plan = await generateWeeklyPlan(payload);
      setWeeklyPlan(plan);
    } catch (err) {
      console.error('[weeklyPlan] Error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate plan';
      safeSetPlanError(errorMsg);
    } finally {
      setPlanLoading(false);
    }
  };

  const handleBrandTap = () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if (newCount >= 5) {
      setShowDinos(true);
      setTimeout(() => {
        setShowDinos(false);
        setTapCount(0);
      }, 3500);
    }
  };

  if (activities.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No activities yet</Text>
        <Text style={styles.subtitle}>Go to the Setup tab to create your goal and activities.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {showDinos && (
        <>
          <LaserDinosaur key="dino1" />
          <LaserDinosaur key="dino2" />
          <LaserDinosaur key="dino3" />
        </>
      )}
      <TouchableOpacity onPress={handleBrandTap} activeOpacity={0.8}>
        <Text style={styles.brandTitle}>wohl</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Track Your Day</Text>
      <Text style={styles.subtitle}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Activities</Text>
        <View style={styles.list}>
          {activities.map((activity) => (
            <TouchableOpacity
              key={activity}
              style={styles.item}
              onPress={() => toggleActivity(activity)}
            >
              <View style={[styles.checkbox, completed[activity] && styles.checkboxChecked]}>
                {completed[activity] && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.activityText}>{activity}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How are you feeling today?</Text>
        <Text style={styles.helper}>Rate your progress toward: {outcome}</Text>
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
            <TouchableOpacity
              key={value}
              style={[styles.ratingButton, rating === value && styles.ratingButtonSelected]}
              onPress={() => handleRatingSelect(value)}
            >
              <Text style={[styles.ratingText, rating === value && styles.ratingTextSelected]}>
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity 
          style={styles.analyticsToggle}
          onPress={() => setShowAnalytics(!showAnalytics)}
        >
          <Text style={styles.sectionTitle}>🧪 Testing & Analytics</Text>
          <Text style={styles.toggleIcon}>{showAnalytics ? '▼' : '▶'}</Text>
        </TouchableOpacity>
        
        {showAnalytics && (
          <View style={styles.analyticsContent}>
            <TouchableOpacity style={styles.testButton} onPress={handlePopulateDummyData}>
              <Text style={styles.testButtonText}>Generate 6 Months Dummy Data</Text>
            </TouchableOpacity>
            
            <View style={styles.whoopSection}>
              <Text style={styles.sectionTitle}>Whoop Integration</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Or paste access token here"
                placeholderTextColor="#999"
                value={whoopToken}
                onChangeText={setWhoopToken}
                secureTextEntry
              />
              
              <TouchableOpacity 
                style={styles.testButton} 
                onPress={handleConnectWhoop}
              >
                <Text style={styles.testButtonText}>Connect via OAuth</Text>
              </TouchableOpacity>
              
              {whoopToken && (
                <TouchableOpacity 
                  style={[styles.testButton, isLoadingWhoop && styles.testButtonDisabled]} 
                  onPress={handleFetchWhoopData}
                  disabled={isLoadingWhoop}
                >
                  <Text style={styles.testButtonText}>
                    {isLoadingWhoop ? 'Fetching...' : 'Fetch Whoop Data'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            
            <TouchableOpacity style={styles.analyzeButton} onPress={handleRunAnalysis}>
              <BeakerIcon size={28} color="#ffffff" />
              <Text style={styles.analyzeButtonText}>Run Analysis</Text>
            </TouchableOpacity>

            {regressionResults && regressionResults.impacts.length > 0 && (
              <TouchableOpacity
                style={[styles.testButton, planLoading && styles.buttonDisabled]}
                onPress={handleGeneratePlan}
                disabled={planLoading}
              >
                <Text style={styles.testButtonText}>
                  {planLoading ? 'Generating...' : 'Generate 1-Week Plan'}
                </Text>
              </TouchableOpacity>
            )}

            {planError && planError.trim() && planError.trim() !== '.' && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{planError}</Text>
              </View>
            )}
            
            {insights && insights.trim() && insights.trim() !== '.' && (
              <View style={styles.insightsBox}>
                <Text style={styles.insightsText}>{insights}</Text>
              </View>
            )}
            
            {regressionResults && regressionResults.impacts.length > 0 && (
              <ImpactChart impacts={regressionResults.impacts} />
            )}
            
            {weeklyPlan && weeklyPlan.days && (
              <View style={styles.planContainer}>
                <Text style={styles.planTitle}>Your 1-Week Plan</Text>
                <Text style={styles.planSummary}>{weeklyPlan.summary || ''}</Text>
                {weeklyPlan.rationale ? (
                  <Text style={styles.planRationale}>{weeklyPlan.rationale}</Text>
                ) : null}
                {weeklyPlan.guidelines && weeklyPlan.guidelines.length > 0 && (
                  <View style={styles.guidelinesBox}>
                    <Text style={styles.guidelinesTitle}>Guidelines</Text>
                    {weeklyPlan.guidelines.map((g, i) => (
                      <Text key={i} style={styles.guidelineItem}>• {g}</Text>
                    ))}
                  </View>
                )}
                {weeklyPlan.days.map((day) => (
                  <View key={day.day_index} style={styles.dayCard}>
                    <Text style={styles.dayLabel}>{day.label || ''}</Text>
                    <Text style={styles.dayFocus}>{day.focus || ''}</Text>
                    {day.activities && day.activities.map((act) => (
                      <View key={act.id} style={styles.activityItem}>
                        <Text style={styles.activityName}>{act.name || ''}</Text>
                        {act.instructions ? (
                          <Text style={styles.activityInstructions}>{act.instructions}</Text>
                        ) : null}
                        {act.reason ? (
                          <Text style={styles.activityReason}>{act.reason}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}


            {regressionResults && scatterData.length > 0 && (
              <View style={styles.visualContainer}>
                <Text style={styles.tableTitle}>Predicted vs Actual Outcomes</Text>
                <Text style={styles.chartSubtitle}>R² = {regressionResults.r2.toFixed(3)}</Text>
                
                <View style={styles.chartWrapper}>
                  {/* Y-axis labels */}
                  <View style={styles.yAxisLabels}>
                    <Text style={styles.axisLabel}>10</Text>
                    <Text style={styles.axisLabel}>1</Text>
                  </View>
                  
                  <View style={styles.chartArea}>
                    <View style={styles.scatterPlot}>
                      {/* Diagonal trend line (perfect prediction) */}
                      <svg width="100%" height="100%" style={{ position: 'absolute' }}>
                        <line
                          x1="0%"
                          y1="100%"
                          x2="100%"
                          y2="0%"
                          stroke="rgba(37, 99, 235, 0.3)"
                          strokeWidth="2"
                          strokeDasharray="5,5"
                        />
                      </svg>
                      
                      {/* Data points */}
                      {scatterData.map((point, i) => {
                        const x = ((point.x - 1) / 9) * 100; // Scale 1-10 to 0-100%
                        const y = 100 - ((point.y - 1) / 9) * 100; // Invert Y axis
                        
                        return (
                          <View
                            key={i}
                            style={[
                              styles.dataPoint,
                              {
                                left: `${x}%`,
                                top: `${y}%`,
                              },
                            ]}
                          />
                        );
                      })}
                    </View>
                    
                    {/* Bottom axis labels */}
                    <View style={styles.xAxisLabels}>
                      <Text style={styles.axisLabel}>1</Text>
                      <Text style={styles.axisLabel}>5</Text>
                      <Text style={styles.axisLabel}>10</Text>
                    </View>
                    <Text style={styles.xAxisTitle}>Actual Outcome</Text>
                  </View>
                </View>
              </View>
            )}
            
            {dataPreview.length > 0 && (
              <View style={styles.tableContainer}>
                <Text style={styles.tableTitle}>Data Sample (Last 10 Days)</Text>
                <ScrollView horizontal>
                  <View style={styles.table}>
                    <View style={styles.tableRow}>
                      <Text style={[styles.tableCell, styles.tableHeader, styles.dateCell]}>Date</Text>
                      {Object.keys(dataPreview[0].activities).map(activity => (
                        <Text key={activity} style={[styles.tableCell, styles.tableHeader, styles.activityCell]}>
                          {activity}
                        </Text>
                      ))}
                      <Text style={[styles.tableCell, styles.tableHeader, styles.outcomeHeaderCell]}>Outcome</Text>
                    </View>
                    {dataPreview.map((row, i) => (
                      <View key={i} style={styles.tableRow}>
                        <Text style={[styles.tableCell, styles.dateCell]}>{row.date.slice(5)}</Text>
                        {Object.keys(dataPreview[0].activities).map(activity => (
                          <Text key={activity} style={[styles.tableCell, styles.activityCell]}>
                            {row.activities[activity] ? '1' : '0'}
                          </Text>
                        ))}
                        <Text style={[styles.tableCell, styles.outcomeCell, styles.outcomeDataCell]}>
                          {typeof row.outcome === 'number' ? row.outcome : 'N/A'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </View>
      
      {whoopData.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Whoop Data</Text>
          <ScrollView horizontal>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.tableHeader, styles.dateCell]}>Date</Text>
                <Text style={[styles.tableCell, styles.tableHeader, styles.activityCell]}>Strain</Text>
                <Text style={[styles.tableCell, styles.tableHeader, styles.activityCell]}>Recovery</Text>
                <Text style={[styles.tableCell, styles.tableHeader, styles.activityCell]}>HRV</Text>
                <Text style={[styles.tableCell, styles.tableHeader, styles.activityCell]}>Sleep (hrs)</Text>
                <Text style={[styles.tableCell, styles.tableHeader, styles.activityCell]}>Sleep %</Text>
              </View>
              {whoopData.slice(0, 10).map((row, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.dateCell]}>{row.date}</Text>
                  <Text style={[styles.tableCell, styles.activityCell]}>
                    {row.strain?.toFixed(1) || '-'}
                  </Text>
                  <Text style={[styles.tableCell, styles.activityCell]}>
                    {row.recoveryScore || '-'}
                  </Text>
                  <Text style={[styles.tableCell, styles.activityCell]}>
                    {row.hrv?.toFixed(0) || '-'}
                  </Text>
                  <Text style={[styles.tableCell, styles.activityCell]}>
                    {row.sleepDuration?.toFixed(1) || '-'}
                  </Text>
                  <Text style={[styles.tableCell, styles.activityCell]}>
                    {row.sleepPerformance || '-'}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 32,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#f55e61',
    letterSpacing: -1,
    marginBottom: -8,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: '#666666',
    marginTop: -8,
  },
  section: {
    gap: 16,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1a1a1a',
  },
  helper: {
    fontSize: 12,
    opacity: 0.8,
  },
  list: {
    gap: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,150,150,0.5)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2563eb',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  activityText: {
    fontSize: 16,
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  ratingButton: {
    width: 50,
    height: 50,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingButtonSelected: {
    backgroundColor: '#2563eb',
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2563eb',
  },
  ratingTextSelected: {
    color: '#fff',
  },
  analyticsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleIcon: {
    fontSize: 16,
  },
  analyticsContent: {
    gap: 12,
    marginTop: 8,
  },
  testButton: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  testButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  planContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(236, 253, 245, 0.6)',
    gap: 12,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065f46',
  },
  planSummary: {
    fontSize: 14,
    lineHeight: 22,
    color: '#047857',
  },
  planRationale: {
    fontSize: 13,
    lineHeight: 20,
    color: '#059669',
    opacity: 0.9,
  },
  guidelinesBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.7)',
    gap: 4,
  },
  guidelinesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065f46',
    marginBottom: 4,
  },
  guidelineItem: {
    fontSize: 13,
    lineHeight: 20,
    color: '#047857',
  },
  dayCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    gap: 8,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065f46',
  },
  dayFocus: {
    fontSize: 13,
    color: '#059669',
    fontStyle: 'italic',
  },
  activityItem: {
    paddingLeft: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(16, 185, 129, 0.4)',
    gap: 4,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  activityInstructions: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748b',
  },
  activityReason: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  insightsBox: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    backgroundColor: 'rgba(239, 246, 255, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  insightsText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
  },
  tableContainer: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    padding: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    color: '#1e293b',
  },
  table: {
    minWidth: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.8)',
    alignItems: 'center',
  },
  tableCell: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 13,
    textAlign: 'center',
    color: '#475569',
  },
  dateCell: {
    width: 90,
    textAlign: 'left',
    fontWeight: '500',
  },
  activityCell: {
    width: 120,
    fontWeight: '500',
  },
  outcomeHeaderCell: {
    width: 100,
  },
  outcomeDataCell: {
    width: 100,
    fontWeight: '700',
    color: '#2563eb',
    fontSize: 14,
  },
  tableHeader: {
    fontWeight: '700',
    backgroundColor: '#f1f5f9',
    color: '#334155',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  outcomeCell: {
    fontWeight: '700',
    color: '#2563eb',
  },
  visualContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartSubtitle: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 16,
    textAlign: 'center',
    color: '#64748b',
  },
  chartWrapper: {
    flexDirection: 'row',
    gap: 8,
  },
  yAxisLabels: {
    justifyContent: 'space-between',
    paddingVertical: 4,
    width: 30,
  },
  chartArea: {
    flex: 1,
  },
  scatterPlot: {
    width: '100%',
    height: 300,
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  dataPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    marginLeft: -4,
    marginTop: -4,
    opacity: 0.7,
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  axisLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  xAxisTitle: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    opacity: 0.8,
  },
  barContainer: {
    marginBottom: 12,
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  barWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bar: {
    height: 24,
    borderRadius: 4,
    minWidth: 2,
  },
  barPositive: {
    backgroundColor: '#10b981',
  },
  barNegative: {
    backgroundColor: '#ef4444',
  },
  barValue: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 50,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderRadius: 16,
    backgroundColor: '#4a90e2',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    marginVertical: 8,
  },
  analyzeButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },
});
