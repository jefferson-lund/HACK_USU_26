import { StyleSheet, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { color, radius, space } from '@/constants/theme';
import Text from './Text';

export type StatTileProps = {
  label: string;
  value: string;
  detail?: string;
  hero?: boolean;
  sparkline?: number[];
};

function pointsFor(values: number[], width: number, height: number) {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
}

export function StatTile({ label, value, detail, hero = false, sparkline = [] }: StatTileProps) {
  const chartWidth = 132;
  const chartHeight = 42;

  return (
    <View style={[styles.tile, hero && styles.hero]}>
      <Text variant="caption" tone="soft" weight="semibold">
        {label}
      </Text>
      <View style={styles.valueRow}>
        <View style={styles.copy}>
          <Text variant={hero ? 'h1' : 'h2'} weight="bold" numeric>
            {value}
          </Text>
          {detail ? (
            <Text variant="caption" tone="soft">
              {detail}
            </Text>
          ) : null}
        </View>
        {sparkline.length > 1 ? (
          <Svg width={chartWidth} height={chartHeight} accessibilityLabel={`${label} recent trend`}>
            <Polyline
              points={pointsFor(sparkline, chartWidth, chartHeight)}
              fill="none"
              stroke={color.primaryStrong}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 132,
    gap: space.xxs,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
  },
  hero: {
    width: '100%',
    flexBasis: '100%',
    backgroundColor: color.surfaceInfo,
    borderColor: color.primary,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  copy: {
    flexShrink: 1,
    gap: space.xxs,
  },
});

export default StatTile;
