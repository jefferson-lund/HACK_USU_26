import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { ActivityImpact } from '@/lib/analysis';

interface ImpactChartProps {
  impacts: ActivityImpact[];
  /**
   * Which analysis produced these numbers. Pearson coefficients are a bounded
   * correlation (-1..1); regression coefficients are unbounded outcome points.
   * They cannot share a format, and this component used to render both as a
   * percentage -- so a regression coefficient of 2.3 displayed as "+230%".
   */
  method?: 'multiple-regression' | 'pearson-correlation';
}

export default function ImpactChart({ impacts, method = 'multiple-regression' }: ImpactChartProps) {
  // Filter for significant impacts only
  const significantImpacts = impacts.filter(
    (impact) => Math.abs(impact.coefficient) > 0.1
  );

  if (significantImpacts.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>
          No significant impacts found (threshold: |coefficient| &gt; 0.1)
        </Text>
      </View>
    );
  }

  // Sort by coefficient value
  const sortedImpacts = [...significantImpacts].sort(
    (a, b) => b.coefficient - a.coefficient
  );

  // Find max absolute value for scaling
  const maxAbs = Math.max(...sortedImpacts.map((i) => Math.abs(i.coefficient)));

  // Ramp from a pale tint of the hue up to the saturated colour.
  //
  // This previously interpolated a single channel from an unrelated base, so a
  // weak positive rendered rgb(16, 16, 129) (navy) and a weak negative
  // rgb(0, 68, 68) (dark teal) -- visually near-identical, while the legend
  // promised green and red. For small coefficients you could not tell which
  // direction an activity pushed.
  const mix = (from: number, to: number, t: number) => Math.round(from + (to - from) * t);

  const getIntensity = (coefficient: number) => Math.abs(coefficient) / maxAbs;

  const getColor = (coefficient: number) => {
    const t = getIntensity(coefficient);
    return coefficient > 0
      ? `rgb(${mix(226, 16, t)}, ${mix(245, 185, t)}, ${mix(237, 129, t)})`
      : `rgb(${mix(254, 239, t)}, ${mix(226, 68, t)}, ${mix(226, 68, t)})`;
  };

  // White text is unreadable on the pale end of the ramp.
  const getTextColor = (coefficient: number) =>
    getIntensity(coefficient) > 0.55 ? '#ffffff' : '#1e293b';

  const formatValue = (coefficient: number) => {
    const sign = coefficient > 0 ? '+' : '';
    return method === 'pearson-correlation'
      ? `r ${sign}${coefficient.toFixed(2)}`
      : `${sign}${coefficient.toFixed(2)} pts`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Activity Impact Heatmap</Text>
      <Text style={styles.subtitle}>
        {method === 'pearson-correlation'
          ? 'Correlation strength (r), for activities with |r| > 0.1'
          : 'Effect on your rating, in points, for activities with |effect| > 0.1'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.heatmap}>
          {/* Header row */}
          <View style={styles.row}>
            <View style={[styles.cell, styles.headerCell]}>
              <Text style={styles.headerText}>Activity</Text>
            </View>
            <View style={[styles.cell, styles.headerCell]}>
              <Text style={styles.headerText}>Coefficient</Text>
            </View>
            <View style={[styles.cell, styles.headerCell]}>
              <Text style={styles.headerText}>Impact</Text>
            </View>
          </View>
          
          {/* Data rows */}
          {sortedImpacts.map((impact, i) => (
            <View key={i} style={styles.row}>
              <View style={[styles.cell, styles.labelCell]}>
                <Text style={styles.labelText}>{impact.activity}</Text>
              </View>
              <View style={[styles.cell, styles.valueCell]}>
                <Text style={styles.valueText}>{impact.coefficient.toFixed(3)}</Text>
              </View>
              <View 
                style={[
                  styles.cell, 
                  styles.heatCell,
                  { backgroundColor: getColor(impact.coefficient) }
                ]}
              >
                <Text style={[styles.heatText, { color: getTextColor(impact.coefficient) }]}>
                  {formatValue(impact.coefficient)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#10b981' }]} />
          <Text style={styles.legendText}>Positive Impact</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.legendText}>Negative Impact</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,150,150,0.5)',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 11,
    opacity: 0.7,
    marginBottom: 12,
    textAlign: 'center',
  },
  heatmap: {
    minWidth: '100%',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  cell: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCell: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    minWidth: 150,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600',
  },
  labelCell: {
    minWidth: 180,
    alignItems: 'flex-start',
  },
  labelText: {
    fontSize: 12,
    fontWeight: '500',
  },
  valueCell: {
    minWidth: 120,
  },
  valueText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  heatCell: {
    minWidth: 150,
  },
  heatText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    opacity: 0.8,
  },
  noDataText: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
