import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import Button from '@/components/ui/Button';
import DataGrid, { type DataGridColumn } from '@/components/ui/DataGrid';
import Text from '@/components/ui/Text';
import { color, radius, space } from '@/constants/theme';
import type { ActivityImpact, RegressionResult } from '@/lib/analysis';

export type ImpactBarsProps = {
  impacts: ActivityImpact[];
  method: RegressionResult['method'];
};

function formattedValue(value: number, method: RegressionResult['method']) {
  const sign = value > 0 ? '+' : '';
  return method === 'pearson-correlation'
    ? `r ${sign}${value.toFixed(2)}`
    : `${sign}${value.toFixed(2)} pts`;
}

export function ImpactBars({ impacts, method }: ImpactBarsProps) {
  const [showTable, setShowTable] = useState(false);
  const maxAbs = Math.max(0.01, ...impacts.map((impact) => Math.abs(impact.coefficient)));
  const columns = useMemo<DataGridColumn<ActivityImpact>[]>(
    () => [
      {
        key: 'activity',
        label: 'Activity',
        width: 190,
        render: (impact) => impact.activity,
      },
      {
        key: 'effect',
        label: method === 'pearson-correlation' ? 'Correlation' : 'Estimated effect',
        width: 140,
        align: 'right',
        render: (impact) => formattedValue(impact.coefficient, method),
      },
      {
        key: 'strength',
        label: 'Signal',
        width: 150,
        render: (impact) => impact.impact,
      },
    ],
    [method],
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.chartHeader}>
        <Text variant="small" tone="soft">
          Hurts ←
        </Text>
        <Text variant="small" tone="soft">
          → Helps
        </Text>
      </View>

      {impacts.map((impact) => {
        const width = `${Math.max(2, (Math.abs(impact.coefficient) / maxAbs) * 72)}%` as `${number}%`;
        const positive = impact.coefficient >= 0;
        return (
          <View key={impact.activity} style={styles.item}>
            <Text variant="small" weight="semibold" numberOfLines={2}>
              {impact.activity}
            </Text>
            <View style={styles.barTrack}>
              <View style={styles.axis} />
              <View style={styles.half}>
                {!positive ? (
                  <View style={styles.negativeContent}>
                    <Text variant="caption" numeric>
                      {formattedValue(impact.coefficient, method)}
                    </Text>
                    <View style={[styles.bar, styles.negativeBar, { width }]} />
                  </View>
                ) : null}
              </View>
              <View style={styles.half}>
                {positive ? (
                  <View style={styles.positiveContent}>
                    <View style={[styles.bar, styles.positiveBar, { width }]} />
                    <Text variant="caption" numeric>
                      {formattedValue(impact.coefficient, method)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}

      <Button variant="ghost" size="small" onPress={() => setShowTable((current) => !current)}>
        {showTable ? 'Show as chart' : 'Show as table'}
      </Button>

      {showTable ? (
        <DataGrid
          columns={columns}
          rows={impacts}
          getRowKey={(impact) => impact.activity}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: space.md,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.xs,
  },
  item: {
    gap: space.xs,
  },
  barTrack: {
    position: 'relative',
    flexDirection: 'row',
    minHeight: 24,
  },
  half: {
    width: '50%',
    justifyContent: 'center',
  },
  axis: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: StyleSheet.hairlineWidth,
    backgroundColor: color.slateFaint,
    zIndex: 2,
  },
  negativeContent: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.xxs,
  },
  positiveContent: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
  },
  bar: {
    height: 20,
    minWidth: 2,
  },
  negativeBar: {
    backgroundColor: color.chartNegative,
    borderTopLeftRadius: radius.sm,
    borderBottomLeftRadius: radius.sm,
  },
  positiveBar: {
    backgroundColor: color.chartPositive,
    borderTopRightRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
  },
});

export default ImpactBars;
