import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import BeakerIcon from '@/components/BeakerIcon';
import Button from '@/components/ui/Button';
import Callout from '@/components/ui/Callout';
import Card from '@/components/ui/Card';
import DataGrid, { type DataGridColumn } from '@/components/ui/DataGrid';
import Field from '@/components/ui/Field';
import Meter from '@/components/ui/Meter';
import PillGroup from '@/components/ui/PillGroup';
import Section from '@/components/ui/Section';
import StatTile from '@/components/ui/StatTile';
import Text from '@/components/ui/Text';
import FitScatter, { type ScatterPoint } from '@/components/v2/FitScatter';
import ImpactBars from '@/components/v2/ImpactBars';
import InsightList from '@/components/v2/InsightList';
import WeeklyPlan from '@/components/v2/WeeklyPlan';
import Wordmark from '@/components/v2/Wordmark';
import { color, layout, radius, space, type as typeScale } from '@/constants/theme';
import {
  enrichDataWithWhoop,
  generateDummyData,
  getRegressionAnalysis,
  type CheckIn,
  type RegressionResult,
} from '@/lib/analysis';
import { buildWeeklyPlanPayload, generateWeeklyPlan, type WeeklyPlan as WeeklyPlanData } from '@/lib/api/weeklyPlan';
import {
  clearOutcomeRating,
  clearSyntheticData,
  getActivityLogs,
  getFullDataset,
  getOutcomeRating,
  getSetup,
  getWhoopData,
  getWhoopToken,
  initDatabase,
  logActivity,
  logOutcomeRating,
  populateDummyData,
  saveWhoopData,
  saveWhoopToken,
} from '@/lib/database';
import { dateKey } from '@/lib/dateKey';
import {
  exchangeCodeForToken,
  formatWhoopDataForAnalysis,
  getWhoopAuthUrl,
  getWhoopCycles,
  getWhoopRecovery,
  getWhoopSleep,
  isWhoopConfigured,
} from '@/lib/whoop';

type DatasetRow = Awaited<ReturnType<typeof getFullDataset>>[number];
type WhoopRow = Awaited<ReturnType<typeof getWhoopData>>[number];

type DashboardStats = {
  daysLogged: number;
  average: number | null;
  delta: number | null;
  streak: number;
  sparkline: number[];
};

const EMPTY_STATS: DashboardStats = {
  daysLogged: 0,
  average: null,
  delta: null,
  streak: 0,
  sparkline: [],
};

const RATING_OPTIONS = Array.from({ length: 10 }, (_, index) => ({
  value: index + 1,
  label: String(index + 1),
  accessibilityLabel: `Rating ${index + 1} out of 10`,
}));

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function previousDate(key: string) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return dateKey(date);
}

function currentStreak(ratedDates: Set<string>, today: string) {
  let cursor = today;
  if (!ratedDates.has(cursor)) cursor = previousDate(cursor);
  let streak = 0;
  while (ratedDates.has(cursor)) {
    streak += 1;
    cursor = previousDate(cursor);
  }
  return streak;
}

function deriveStats(dataset: DatasetRow[], today: string): DashboardStats {
  const rated = dataset.filter((row): row is DatasetRow & { outcome: number } => row.outcome !== null);
  const recent = rated.slice(0, 7).map((row) => row.outcome);
  const prior = rated.slice(7, 14).map((row) => row.outcome);
  const recentAverage = average(recent);
  const priorAverage = average(prior);

  return {
    daysLogged: rated.length,
    average: recentAverage,
    delta:
      recentAverage !== null && priorAverage !== null ? recentAverage - priorAverage : null,
    streak: currentStreak(new Set(rated.map((row) => row.date)), today),
    sparkline: rated.slice(0, 12).reverse().map((row) => row.outcome),
  };
}

function displayDate(key: string) {
  return new Date(`${key}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function TrackScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const resultsYRef = useRef(0);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planGenRef = useRef(0);
  const savedOpacity = useRef(new Animated.Value(0)).current;

  const [isLoading, setIsLoading] = useState(true);
  const [today, setToday] = useState(() => dateKey());
  const [activities, setActivities] = useState<string[]>([]);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [dataset, setDataset] = useState<DatasetRow[]>([]);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [savedMessage, setSavedMessage] = useState('Saved');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [regressionResults, setRegressionResults] = useState<RegressionResult | null>(null);
  const [scatterData, setScatterData] = useState<ScatterPoint[]>([]);
  const [validDataForPlan, setValidDataForPlan] = useState<CheckIn[]>([]);
  const [useLag, setUseLag] = useState(false);
  const [resultsStale, setResultsStale] = useState(false);

  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanData | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [confirmingClear, setConfirmingClear] = useState(false);
  const [whoopData, setWhoopData] = useState<WhoopRow[]>([]);
  const [whoopToken, setWhoopToken] = useState('');
  const [isLoadingWhoop, setIsLoadingWhoop] = useState(false);

  const showSaved = useCallback(
    (message = 'Saved') => {
      setSavedMessage(message);
      savedOpacity.stopAnimation();
      savedOpacity.setValue(1);
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(savedOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [savedOpacity],
  );

  const loadDashboard = useCallback(async (day: string) => {
    try {
      await initDatabase();
      const [setup, logs, savedRating, fullDataset, token, savedWhoop] = await Promise.all([
        getSetup(),
        getActivityLogs(day),
        getOutcomeRating(day),
        getFullDataset(),
        getWhoopToken(),
        getWhoopData(),
      ]);

      setActivities(setup?.activities ?? []);
      setOutcome(setup?.outcome ?? '');
      setCompleted(logs);
      setRating(savedRating);
      setDataset(fullDataset);
      setStats(deriveStats(fullDataset, day));
      setWhoopToken(token ?? '');
      setWhoopData(savedWhoop);
      setActionError(null);
    } catch (error) {
      console.error('Failed to load track data:', error);
      setActionError('Could not load your check-in data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const focusedDay = dateKey();
      setToday(focusedDay);
      void loadDashboard(focusedDay);
    }, [loadDashboard]),
  );

  useEffect(
    () => () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      savedOpacity.stopAnimation();
    },
    [savedOpacity],
  );

  const markResultsChanged = useCallback(() => {
    if (regressionResults) setResultsStale(true);
  }, [regressionResults]);

  const reloadDataset = useCallback(async () => {
    const fullDataset = await getFullDataset();
    setDataset(fullDataset);
    setStats(deriveStats(fullDataset, today));
  }, [today]);

  const toggleActivity = async (activity: string) => {
    const previous = Boolean(completed[activity]);
    const next = !previous;
    setCompleted((current) => ({ ...current, [activity]: next }));
    setActionError(null);
    try {
      await logActivity(activity, next, today);
      await reloadDataset();
      markResultsChanged();
      showSaved();
    } catch (error) {
      console.error('Failed to log activity:', error);
      setCompleted((current) => ({ ...current, [activity]: previous }));
      setActionError('Could not save that activity. Please try again.');
    }
  };

  const handleRatingSelect = async (value: number | null) => {
    const previous = rating;
    setRating(value);
    setActionError(null);
    try {
      if (value === null) {
        await clearOutcomeRating(today);
      } else {
        await logOutcomeRating(value, today);
      }
      await reloadDataset();
      markResultsChanged();
      showSaved(value === null ? 'Rating cleared' : 'Saved');
    } catch (error) {
      console.error('Failed to log rating:', error);
      setRating(previous);
      setActionError('Could not save that rating. Please try again.');
    }
  };

  const runAnalysis = useCallback(
    async (lag: boolean) => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const [fullDataset, savedWhoop] = await Promise.all([getFullDataset(), getWhoopData()]);
      let validData: CheckIn[] = fullDataset
        .filter((row): row is DatasetRow & { outcome: number } => row.outcome !== null)
        .map((row) => ({
          date: row.date,
          activities: row.activities,
          outcome: row.outcome,
        }));

      if (savedWhoop.length > 0) validData = enrichDataWithWhoop(validData, savedWhoop);

      const results = getRegressionAnalysis(validData, lag);
      setRegressionResults(results);
      setValidDataForPlan(validData);
      setScatterData(
        results.predictions && results.actuals
          ? results.actuals.map((actual, index) => ({
              x: actual,
              y: results.predictions?.[index] ?? 0,
              predicted: results.predictions?.[index] ?? 0,
              date: results.dates?.[index] ?? '',
            }))
          : [],
      );
      setWeeklyPlan(null);
      setPlanError(null);
      setResultsStale(false);
    },
    [],
  );

  const handleRunAnalysis = useCallback(
    async (lag = useLag, scrollToResults = true) => {
      if (analysisRunning) return;
      setAnalysisRunning(true);
      setAnalysisError(null);
      try {
        await runAnalysis(lag);
        if (scrollToResults) {
          requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({
              y: Math.max(0, resultsYRef.current - space.lg),
              animated: true,
            });
          });
        }
      } catch (error) {
        console.error('Analysis failed:', error);
        setAnalysisError('Could not run the analysis. Please try again.');
      } finally {
        setAnalysisRunning(false);
      }
    },
    [analysisRunning, runAnalysis, useLag],
  );

  const handleLagChange = (value: 'same' | 'next' | null) => {
    if (!value) return;
    const nextLag = value === 'next';
    setUseLag(nextLag);
    if (regressionResults) void handleRunAnalysis(nextLag, false);
  };

  const handleGeneratePlan = async () => {
    if (!regressionResults || !outcome || validDataForPlan.length === 0) return;
    const generation = ++planGenRef.current;
    setPlanLoading(true);
    setPlanError(null);
    try {
      const payload = buildWeeklyPlanPayload(outcome, regressionResults, validDataForPlan);
      const plan = await generateWeeklyPlan(payload);
      if (generation === planGenRef.current) setWeeklyPlan(plan);
    } catch (error) {
      if (generation !== planGenRef.current) return;
      console.error('[weeklyPlan] Error:', error);
      setPlanError(error instanceof Error ? error.message : 'Could not generate a weekly plan.');
    } finally {
      if (generation === planGenRef.current) setPlanLoading(false);
    }
  };

  const handlePopulateDummyData = async () => {
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await populateDummyData(generateDummyData(6, activities));
      await loadDashboard(today);
      markResultsChanged();
      setActionNotice(
        result.skipped > 0
          ? `Added ${result.inserted} days of sample data and kept ${result.skipped} existing ${
              result.skipped === 1 ? 'day' : 'days'
            }.`
          : `Added ${result.inserted} days of sample data.`,
      );
    } catch (error) {
      console.error('Failed to populate sample data:', error);
      setActionError('Could not add sample data. Please try again.');
    }
  };

  const handleClearTestData = async () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => {
        confirmTimerRef.current = null;
        setConfirmingClear(false);
      }, 4000);
      return;
    }

    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = null;
    setConfirmingClear(false);
    setActionError(null);
    try {
      await clearSyntheticData();
      await loadDashboard(today);
      setRegressionResults(null);
      setScatterData([]);
      setWeeklyPlan(null);
      setActionNotice('Sample data deleted. Your own check-ins were kept.');
    } catch (error) {
      console.error('Failed to clear sample data:', error);
      setActionError('Could not delete the sample data. Please try again.');
    }
  };

  const fetchWhoopDataWithToken = useCallback(async (token: string) => {
    setIsLoadingWhoop(true);
    setActionError(null);
    try {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
      const [cycles, recoveries, sleeps] = await Promise.all([
        getWhoopCycles(token, startDate, endDate),
        getWhoopRecovery(token, startDate, endDate),
        getWhoopSleep(token, startDate, endDate),
      ]);
      const formatted = formatWhoopDataForAnalysis(cycles, recoveries, sleeps);
      await saveWhoopData(formatted);
      setWhoopData(formatted);
      setActionNotice(`Fetched and saved ${formatted.length} days of WHOOP data.`);
      markResultsChanged();
    } catch (error) {
      console.error('Failed to fetch WHOOP data:', error);
      setActionError('Could not fetch WHOOP data. Check your connection and token.');
    } finally {
      setIsLoadingWhoop(false);
    }
  }, [markResultsChanged]);

  useFocusEffect(
    useCallback(() => {
      const handleDeepLink = async (event: { url: string }) => {
        const { queryParams } = Linking.parse(event.url);
        if (!queryParams?.code) return;
        try {
          const token = await exchangeCodeForToken(String(queryParams.code));
          setWhoopToken(token.access_token);
          await saveWhoopToken(token.access_token, token.refresh_token);
          setActionNotice('WHOOP connected successfully.');
          await fetchWhoopDataWithToken(token.access_token);
        } catch (error) {
          console.error('WHOOP OAuth failed:', error);
          setActionError('Could not connect to WHOOP.');
        }
      };

      const subscription = Linking.addEventListener('url', handleDeepLink);
      return () => subscription.remove();
    }, [fetchWhoopDataWithToken]),
  );

  const handleConnectWhoop = async () => {
    try {
      await WebBrowser.openAuthSessionAsync(getWhoopAuthUrl());
    } catch (error) {
      console.error('Failed to open WHOOP authorization:', error);
      setActionError(
        error instanceof Error ? error.message : 'Could not open WHOOP authorization.',
      );
    }
  };

  const handleFetchWhoopData = async () => {
    if (!whoopToken.trim()) {
      setActionError('Enter or connect a WHOOP token first.');
      return;
    }
    await saveWhoopToken(whoopToken.trim());
    await fetchWhoopDataWithToken(whoopToken.trim());
  };

  const completedCount = activities.filter((activity) => completed[activity]).length;
  const ratingDelta =
    stats.delta === null
      ? 'No prior week yet'
      : `${stats.delta >= 0 ? '+' : ''}${stats.delta.toFixed(1)} vs prior week`;
  const resultsReady = Boolean(regressionResults && regressionResults.impacts.length > 0);

  const checkInColumns = useMemo<DataGridColumn<DatasetRow>[]>(
    () => [
      { key: 'date', label: 'Date', width: 120, render: (row) => row.date },
      {
        key: 'rating',
        label: 'Rating',
        width: 90,
        align: 'right',
        render: (row) => row.outcome?.toString() ?? '—',
      },
      ...activities.map((activity) => ({
        key: activity,
        label: activity,
        width: 150,
        align: 'center' as const,
        render: (row: DatasetRow) => (row.activities[activity] ? 'Yes' : '—'),
      })),
    ],
    [activities],
  );

  const scatterColumns = useMemo<DataGridColumn<ScatterPoint>[]>(
    () => [
      { key: 'date', label: 'Outcome date', width: 130, render: (point) => point.date },
      {
        key: 'actual',
        label: 'Actual',
        width: 100,
        align: 'right',
        render: (point) => point.x.toFixed(1),
      },
      {
        key: 'predicted',
        label: 'Predicted',
        width: 110,
        align: 'right',
        render: (point) => point.predicted.toFixed(1),
      },
    ],
    [],
  );

  const whoopColumns = useMemo<DataGridColumn<WhoopRow>[]>(
    () => [
      { key: 'date', label: 'Date', width: 120, render: (row) => row.date },
      { key: 'recovery', label: 'Recovery', width: 110, render: (row) => row.recoveryScore?.toString() ?? '—' },
      { key: 'strain', label: 'Strain', width: 90, render: (row) => row.strain?.toString() ?? '—' },
      { key: 'sleep', label: 'Sleep', width: 90, render: (row) => row.sleepDuration?.toString() ?? '—' },
      { key: 'hrv', label: 'HRV', width: 90, render: (row) => row.hrv?.toString() ?? '—' },
    ],
    [],
  );

  const recordResultsPosition = (event: LayoutChangeEvent) => {
    resultsYRef.current = event.nativeEvent.layout.y;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <View style={styles.loadingContent}>
          <Wordmark size="sm" align="left" />
          <View style={styles.loadingHeading} />
          <Card>
            <View style={styles.loadingCard}>
              <View style={styles.loadingLine} />
              <View style={styles.loadingField} />
              <View style={styles.loadingField} />
            </View>
          </Card>
        </View>
      </View>
    );
  }

  if (activities.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <View style={styles.emptyContent}>
          <Wordmark />
          <Card style={styles.emptyCard}>
            <Text variant="h1">Create your experiment first</Text>
            <Text variant="body" tone="soft">
              Add an outcome and a few daily activities before you begin tracking.
            </Text>
            {actionError ? <Callout tone="danger">{actionError}</Callout> : null}
            <Button variant="hero" onPress={() => router.push('/')}>
              Go to setup
            </Button>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <View style={styles.header}>
          <Wordmark size="sm" align="left" />
          <View style={styles.headerCopy}>
            <Text variant="h1">Your dashboard</Text>
            <Text variant="body" tone="soft">
              {displayDate(today)}
            </Text>
          </View>
          <View style={styles.compactStats}>
            <Text variant="caption" tone="soft">
              {stats.daysLogged} days logged
            </Text>
            <Text variant="caption" tone="soft">
              {stats.streak} day streak
            </Text>
          </View>
        </View>

        {actionError ? <Callout tone="danger">{actionError}</Callout> : null}
        {actionNotice ? <Callout tone="success">{actionNotice}</Callout> : null}

        <Section title="Today’s check-in" description={`Tracking progress toward: ${outcome}`}>
          <Card style={styles.checkInCard}>
            <Meter
              value={completedCount}
              max={activities.length}
              label="Activities completed"
            />
            <View style={styles.activityList}>
              {activities.map((activity) => {
                const checked = Boolean(completed[activity]);
                return (
                  <Pressable
                    key={activity}
                    onPress={() => void toggleActivity(activity)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    style={({ pressed }) => [
                      styles.activityRow,
                      checked && styles.activityRowChecked,
                      pressed && styles.rowPressed,
                    ]}>
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked ? (
                        <Text variant="small" tone="inverse" weight="bold">
                          ✓
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      variant="body"
                      weight="medium"
                      style={checked ? styles.completedActivity : undefined}>
                      {activity}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.ratingBlock}>
              <View style={styles.ratingHeader}>
                <View style={styles.ratingCopy}>
                  <Text variant="h2">How are you feeling?</Text>
                  <Text variant="small" tone="soft">
                    Rate today’s progress from rough to great.
                  </Text>
                </View>
                <Animated.Text style={[styles.savedText, { opacity: savedOpacity }]}>
                  {savedMessage}
                </Animated.Text>
              </View>
              <PillGroup
                options={RATING_OPTIONS}
                value={rating}
                onChange={handleRatingSelect}
                label="Daily outcome rating"
                allowClear
                compact
              />
              <View style={styles.ratingAnchors}>
                <Text variant="caption" tone="soft">
                  Rough
                </Text>
                <Text variant="caption" tone="soft">
                  Great
                </Text>
              </View>
              {rating !== null ? (
                <Text variant="caption" tone="soft">
                  Press the selected number again to clear today’s rating.
                </Text>
              ) : null}
            </View>
          </Card>
        </Section>

        <Section title="Headline stats" description="A quick view from your saved check-ins.">
          <View style={styles.statGrid}>
            <StatTile
              hero
              label="7-day average"
              value={stats.average === null ? '—' : stats.average.toFixed(1)}
              detail={ratingDelta}
              sparkline={stats.sparkline}
            />
            <StatTile label="Days logged" value={String(stats.daysLogged)} />
            <StatTile label="Current streak" value={`${stats.streak} ${stats.streak === 1 ? 'day' : 'days'}`} />
          </View>
        </Section>

        <View onLayout={recordResultsPosition}>
          <Section
            title="What’s working"
            description={
              useLag
                ? 'Next-day compares each activity with tomorrow’s rating.'
                : 'Same-day compares each activity with that day’s rating.'
            }
            action={
              <PillGroup
                options={[
                  { value: 'same', label: 'Same-day' },
                  { value: 'next', label: 'Next-day' },
                ]}
                value={useLag ? 'next' : 'same'}
                onChange={handleLagChange}
                label="Analysis timing"
                compact
              />
            }>
          {analysisError ? <Callout tone="danger">{analysisError}</Callout> : null}
          {resultsStale ? (
            <Callout title="Your data changed">
              Refresh the results to include your latest check-in.
            </Callout>
          ) : null}

          {!regressionResults ? (
            <Card style={styles.analysisEmpty}>
              {stats.daysLogged < 10 ? (
                <>
                  <Meter value={stats.daysLogged} max={10} label="Days toward a full model" />
                  <Text variant="body" tone="soft">
                    A full model needs 10 days. Until then, wohl shows simple correlations as early hints.
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.beaker}>
                    <BeakerIcon size={34} color={color.primaryStrong} />
                  </View>
                  <Text variant="h2">Your data is ready</Text>
                  <Text variant="body" tone="soft" align="center">
                    Run the analysis when you’re ready to look for patterns.
                  </Text>
                </>
              )}
              <Button
                variant="hero"
                fullWidth
                loading={analysisRunning}
                icon={<BeakerIcon size={24} color={color.textOnColor} />}
                onPress={() => void handleRunAnalysis()}>
                {stats.daysLogged < 10 ? 'See early signals' : 'Run analysis'}
              </Button>
            </Card>
          ) : (
            <Card busy={analysisRunning} style={styles.resultsCard}>
              <View style={styles.resultsHeader}>
                <View style={styles.resultsHeaderCopy}>
                  <Text variant="h2">Your strongest signals</Text>
                  <Text variant="small" tone="soft">
                    Based on {regressionResults.sampleSize} aligned check-ins ·{' '}
                    {regressionResults.method === 'multiple-regression'
                      ? 'full model'
                      : 'early correlations'}
                  </Text>
                </View>
                <Button
                  variant="ghost"
                  size="small"
                  loading={analysisRunning}
                  onPress={() => void handleRunAnalysis()}>
                  {resultsStale ? 'Refresh results' : 'Run again'}
                </Button>
              </View>

              {resultsReady ? (
                <>
                  <InsightList results={regressionResults} />
                  <View style={styles.resultBlock}>
                    <Text variant="h2">Impact overview</Text>
                    <ImpactBars
                      impacts={regressionResults.impacts}
                      method={regressionResults.method}
                    />
                  </View>
                  {scatterData.length > 0 ? (
                    <View style={styles.resultBlock}>
                      <Text variant="h2">Predicted vs. actual</Text>
                      <FitScatter r2={regressionResults.r2} data={scatterData} />
                    </View>
                  ) : null}
                </>
              ) : (
                <Callout tone="neutral">
                  There are not enough aligned check-ins for this timing mode yet.
                </Callout>
              )}
            </Card>
          )}
          </Section>
        </View>

        <Section
          title="Your week"
          description="Turn your strongest signals into a practical seven-day plan.">
          {planError ? <Callout tone="danger">{planError}</Callout> : null}
          {weeklyPlan ? <WeeklyPlan plan={weeklyPlan} /> : null}
          <Button
            variant={weeklyPlan ? 'secondary' : 'primary'}
            loading={planLoading}
            disabled={!regressionResults || validDataForPlan.length === 0}
            onPress={() => void handleGeneratePlan()}>
            {weeklyPlan ? 'Regenerate plan' : 'Generate a one-week plan'}
          </Button>
          {!regressionResults ? (
            <Text variant="small" tone="soft">
              Run the analysis first to create a plan from your data.
            </Text>
          ) : null}
        </Section>

        <Section
          title="Data"
          description="Inspect recent check-ins and the rows used by the model."
          collapsible
          defaultExpanded={false}>
          {scatterData.length > 0 ? (
            <View style={styles.dataBlock}>
              <Text variant="h2">Model rows</Text>
              <DataGrid
                columns={scatterColumns}
                rows={scatterData}
                getRowKey={(point, index) => `${point.date}-${index}`}
              />
            </View>
          ) : null}
          <View style={styles.dataBlock}>
            <Text variant="h2">Recent check-ins</Text>
            <DataGrid
              columns={checkInColumns}
              rows={dataset.slice(0, 10)}
              getRowKey={(row) => row.date}
              emptyMessage="Complete your first check-in to see it here."
            />
          </View>
        </Section>

        <Section
          title="Developer tools"
          description="Sample data and optional integrations."
          collapsible
          defaultExpanded={false}
          quiet>
          <Card tone="quiet" style={styles.devTools}>
            <Text variant="small" tone="soft">
              Sample data is synthetic and can be removed without deleting your own check-ins.
            </Text>
            <View style={styles.devActions}>
              <Button variant="quiet" onPress={() => void handlePopulateDummyData()}>
                Generate sample data
              </Button>
              <Button variant="danger" onPress={() => void handleClearTestData()}>
                {confirmingClear ? 'Tap again to confirm' : 'Delete sample data'}
              </Button>
            </View>

            {isWhoopConfigured() ? (
              <View style={styles.whoopBlock}>
                <Text variant="h2">WHOOP</Text>
                <Field
                  label="Access token"
                  value={whoopToken}
                  onChangeText={setWhoopToken}
                  placeholder="Paste a WHOOP access token"
                  secureTextEntry
                />
                <View style={styles.devActions}>
                  <Button variant="secondary" onPress={() => void handleConnectWhoop()}>
                    Connect WHOOP
                  </Button>
                  <Button
                    variant="primary"
                    loading={isLoadingWhoop}
                    onPress={() => void handleFetchWhoopData()}>
                    Fetch data
                  </Button>
                </View>
                <DataGrid
                  columns={whoopColumns}
                  rows={whoopData}
                  getRowKey={(row) => row.date}
                  emptyMessage="No WHOOP data fetched yet."
                />
              </View>
            ) : null}
          </Card>
        </Section>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: color.background,
    padding: layout.gutter,
  },
  loadingContent: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    gap: layout.sectionGap,
    paddingTop: space.xxl,
  },
  loadingHeading: {
    width: '48%',
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: color.border,
  },
  loadingCard: {
    gap: space.md,
  },
  loadingLine: {
    width: '65%',
    height: 20,
    borderRadius: radius.sm,
    backgroundColor: color.border,
  },
  loadingField: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: color.surfaceMuted,
  },
  emptyScreen: {
    flex: 1,
    backgroundColor: color.background,
    paddingHorizontal: layout.gutter,
    paddingTop: space.xxl,
  },
  emptyContent: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    gap: layout.sectionGap,
  },
  emptyCard: {
    gap: space.md,
    alignItems: 'flex-start',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: layout.gutter,
    paddingTop: space.xxl,
    paddingBottom: space.xxl + layout.tabBarHeight,
    backgroundColor: color.background,
  },
  content: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    gap: layout.sectionGap,
  },
  header: {
    gap: space.sm,
  },
  headerCopy: {
    gap: space.xxs,
  },
  compactStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  checkInCard: {
    gap: space.lg,
  },
  activityList: {
    gap: space.xs,
  },
  activityRow: {
    minHeight: layout.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  activityRowChecked: {
    backgroundColor: color.surfaceInfo,
    borderColor: color.primary,
  },
  rowPressed: {
    opacity: 0.75,
  },
  checkbox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: color.primaryStrong,
  },
  checkboxChecked: {
    backgroundColor: color.primaryStrong,
  },
  completedActivity: {
    textDecorationLine: 'line-through',
    color: color.textSoft,
  },
  ratingBlock: {
    gap: space.sm,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  ratingHeader: {
    minHeight: layout.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  ratingCopy: {
    flex: 1,
    gap: space.xxs,
  },
  savedText: {
    ...typeScale.small,
    fontWeight: '600',
    color: color.successText,
  },
  ratingAnchors: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.xs,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  analysisEmpty: {
    alignItems: 'center',
    gap: space.md,
  },
  beaker: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: color.surfaceInfo,
  },
  resultsCard: {
    gap: space.lg,
  },
  resultsHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  resultsHeaderCopy: {
    flex: 1,
    minWidth: 220,
    gap: space.xxs,
  },
  resultBlock: {
    gap: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  dataBlock: {
    gap: space.sm,
  },
  devTools: {
    gap: space.md,
  },
  devActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  whoopBlock: {
    gap: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
});
