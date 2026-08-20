import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { Text } from '@/components/Themed';
import { Brand } from '@/constants/Colors';

interface ScatterChartProps {
  r2: number;
  data: Array<{ x: number; y: number; predicted: number; date: string }>;
}

// The "Predicted vs Actual Outcomes" scatter plot.
/** Keeps a computed position inside the plot box; maps NaN to 0. */
const clampPercent = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

export default function ScatterChart({ r2, data }: ScatterChartProps) {
  if (data.length === 0) return null;

  return (
    <View style={styles.visualContainer}>
      <Text style={styles.tableTitle}>Predicted vs Actual Outcomes</Text>
      <Text style={styles.chartSubtitle}>R² = {r2.toFixed(3)}</Text>

      <View style={styles.chartWrapper}>
        {/* Y-axis labels */}
        <View style={styles.yAxisLabels}>
          <Text style={styles.axisLabel}>10</Text>
          <Text style={styles.axisLabel}>1</Text>
        </View>

        <View style={styles.chartArea}>
          <View style={styles.scatterPlot}>
            {/* Diagonal trend line (perfect prediction) */}
            <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
              <Line
                x1="0%"
                y1="100%"
                x2="100%"
                y2="0%"
                stroke="rgba(37, 99, 235, 0.3)"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
            </Svg>

            {/* Data points */}
            {data.map((point, i) => {
              // Clamped because point.y is a regression PREDICTION, which is
              // unbounded -- the model happily extrapolates past the 1-10
              // rating scale (observed up to 11.5, giving top: '-17.1%'). The
              // plot has no overflow:hidden, so those dots escaped upward over
              // the R² caption. NaN would have rendered as top: 'NaN%'.
              const x = clampPercent(((point.x - 1) / 9) * 100);
              const y = clampPercent(100 - ((point.y - 1) / 9) * 100);

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
  );
}

const styles = StyleSheet.create({
  visualContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    backgroundColor: Brand.white,
    shadowColor: Brand.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    color: Brand.slateDark,
  },
  chartSubtitle: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 16,
    textAlign: 'center',
    color: Brand.slateFaint,
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
    backgroundColor: Brand.accentBlue,
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
});
