import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

import { Text, View } from '@/components/Themed';
import { generateDummyData, generateInsightSummary, getRegressionAnalysis, enrichDataWithWhoop } from '@/lib/analysis';
import { clearSyntheticData, getActivityLogs, getFullDataset, getOutcomeRating, getSetup, initDatabase, logActivity, logOutcomeRating, populateDummyData, saveWhoopToken, getWhoopToken, saveWhoopData, getWhoopData } from '@/lib/database';
import { exchangeCodeForToken, formatWhoopDataForAnalysis, getWhoopAuthUrl, getWhoopCycles, getWhoopRecovery, getWhoopSleep } from '@/lib/whoop';
import { buildWeeklyPlanPayload, generateWeeklyPlan, type WeeklyPlan } from '@/lib/api/weeklyPlan';
import ImpactChart from '@/components/ImpactChart';
import BeakerIcon from '@/components/BeakerIcon';
import LaserDinosaur from '@/components/LaserDinosaur';
import WhoopPanel, { WhoopDataTable } from '@/components/track/WhoopPanel';
import ScatterChart from '@/components/track/ScatterChart';
import WeeklyPlanCard from '@/components/track/WeeklyPlanCard';
import DataTable from '@/components/track/DataTable';
import { Brand } from '@/constants/Colors';
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
  const [useLag, setUseLag] = useState(false);
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

  // useFocusEffect, not useEffect: only one screen can hold navigation focus,
  // so this guarantees exactly one live listener even though both the v2 and
  // the legacy Track screen register one. Two listeners would each call
  // exchangeCodeForToken with the same single-use code, and the loser would
  // surface a spurious "Failed to connect" error.
  useFocusEffect(
    useCallback(() => {
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
    }, [])
  );

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

  const handleClearTestData = async () => {
    await clearSyntheticData();
    alert('Cleared test data!');
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

    const results = getRegressionAnalysis(validData, useLag);
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

            <TouchableOpacity style={[styles.testButton, styles.clearTestButton]} onPress={handleClearTestData}>
              <Text style={styles.testButtonText}>Clear Test Data</Text>
            </TouchableOpacity>

            <WhoopPanel
              whoopToken={whoopToken}
              onChangeToken={setWhoopToken}
              isLoadingWhoop={isLoadingWhoop}
              onConnectWhoop={handleConnectWhoop}
              onFetchWhoopData={handleFetchWhoopData}
            />

            <Text style={styles.helper}>Compare activities against:</Text>
            <View style={styles.lagToggleContainer}>
              <TouchableOpacity
                style={[styles.lagToggleButton, !useLag && styles.lagToggleButtonSelected]}
                onPress={() => setUseLag(false)}
              >
                <Text style={[styles.lagToggleText, !useLag && styles.lagToggleTextSelected]}>
                  Same-day
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.lagToggleButton, useLag && styles.lagToggleButtonSelected]}
                onPress={() => setUseLag(true)}
              >
                <Text style={[styles.lagToggleText, useLag && styles.lagToggleTextSelected]}>
                  Next-day
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.analyzeButton} onPress={handleRunAnalysis}>
              <BeakerIcon size={28} color={Brand.white} />
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

            {weeklyPlan && <WeeklyPlanCard plan={weeklyPlan} />}

            {regressionResults && scatterData.length > 0 && (
              <ScatterChart r2={regressionResults.r2} data={scatterData} />
            )}

            <DataTable data={dataPreview} />
          </View>
        )}
      </View>

      <WhoopDataTable whoopData={whoopData} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 32,
    backgroundColor: Brand.white,
    alignItems: 'center',
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: Brand.orange,
    letterSpacing: -1,
    marginBottom: -8,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: Brand.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: Brand.inkSoft,
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
    color: Brand.ink,
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
    borderColor: Brand.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Brand.accentBlue,
  },
  checkmark: {
    color: Brand.white,
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
    borderColor: Brand.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingButtonSelected: {
    backgroundColor: Brand.accentBlue,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    color: Brand.accentBlue,
  },
  ratingTextSelected: {
    color: Brand.white,
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
    backgroundColor: Brand.success,
    alignItems: 'center',
    shadowColor: Brand.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  testButtonText: {
    color: Brand.white,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  clearTestButton: {
    backgroundColor: Brand.danger,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  lagToggleContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  lagToggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Brand.accentBlue,
  },
  lagToggleButtonSelected: {
    backgroundColor: Brand.accentBlue,
  },
  lagToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.accentBlue,
  },
  lagToggleTextSelected: {
    color: Brand.white,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: Brand.danger,
    fontSize: 14,
  },
  insightsBox: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    backgroundColor: 'rgba(239, 246, 255, 0.5)',
    shadowColor: Brand.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  insightsText: {
    fontSize: 14,
    lineHeight: 22,
    color: Brand.slateMed,
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
    backgroundColor: Brand.successLight,
  },
  barNegative: {
    backgroundColor: Brand.dangerLight,
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
    backgroundColor: Brand.blue,
    shadowColor: Brand.blue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    marginVertical: 8,
  },
  analyzeButtonText: {
    color: Brand.white,
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },
});
