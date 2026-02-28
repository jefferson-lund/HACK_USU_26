import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

import ImpactChart from '@/components/ImpactChart';
import { Text, View } from '@/components/Themed';
import { generateDummyData, generateInsightSummary, getRegressionAnalysis } from '@/lib/analysis';
import { getActivityLogs, getFullDataset, getOutcomeRating, getSetup, initDatabase, logActivity, logOutcomeRating, populateDummyData } from '@/lib/database';

export default function TrackScreen() {
  const [activities, setActivities] = useState<string[]>([]);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [insights, setInsights] = useState('');
  const [dataPreview, setDataPreview] = useState<Array<{ date: string; activities: Record<string, boolean>; outcome: number }>>([]);
  const [regressionResults, setRegressionResults] = useState<any>(null);
  const [scatterData, setScatterData] = useState<Array<{ x: number; y: number; predicted: number; date: string }>>([]);
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
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const toggleActivity = async (activity: string) => {
    const newValue = !completed[activity];
    setCompleted(prev => ({ ...prev, [activity]: newValue }));
    await logActivity(activity, newValue, today);
  };

  const handleRatingSelect = async (value: number) => {
    setRating(value);
    await logOutcomeRating(value, today);
  };

  const handlePopulateDummyData = async () => {
    const setup = await getSetup();
    if (!setup || setup.activities.length === 0) {
      alert('Please set up your activities first!');
      return;
    }
    const dummyData = generateDummyData(6, setup.activities);
    await populateDummyData(dummyData);
    alert('Populated 6 months of dummy data!');
    loadData();
  };

  const handleRunAnalysis = async () => {
    const dataset = await getFullDataset();
    console.log('[Track] Full dataset:', dataset.slice(0, 3));
    
    const validData = dataset
      .filter(d => d.outcome !== null && d.outcome !== undefined)
      .map(d => ({
        date: d.date,
        activities: d.activities,
        outcome: d.outcome as number,
      }));
    
    console.log('[Track] Valid data:', validData.slice(0, 3));
    setDataPreview(validData.slice(0, 10)); // Show last 10 days
    
    const results = getRegressionAnalysis(validData, false);
    setRegressionResults(results);
    
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
    setInsights(summary);
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
      <Text style={styles.title}>Today's Activities</Text>
      <Text style={styles.subtitle}>{new Date().toLocaleDateString()}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activities</Text>
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
            
            <TouchableOpacity style={styles.testButton} onPress={handleRunAnalysis}>
              <Text style={styles.testButtonText}>Run Correlation Analysis</Text>
            </TouchableOpacity>
            
            {insights && (
              <View style={styles.insightsBox}>
                <Text style={styles.insightsText}>{insights}</Text>
              </View>
            )}
            
            {regressionResults && regressionResults.impacts.length > 0 && (
              <ImpactChart impacts={regressionResults.impacts} />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 32,
    gap: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
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
});
