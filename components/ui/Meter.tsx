import { StyleSheet, View } from 'react-native';

import { color, radius, space } from '@/constants/theme';
import Text from './Text';

export type MeterProps = {
  value: number;
  max: number;
  label?: string;
  showValue?: boolean;
};

export function Meter({ value, max, label, showValue = true }: MeterProps) {
  const safeMax = Math.max(1, max);
  const clamped = Math.max(0, Math.min(value, safeMax));
  const percent = (clamped / safeMax) * 100;

  return (
    <View
      style={styles.wrapper}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: safeMax, now: clamped }}>
      {label || showValue ? (
        <View style={styles.labelRow}>
          {label ? (
            <Text variant="small" weight="semibold">
              {label}
            </Text>
          ) : (
            <View />
          )}
          {showValue ? (
            <Text variant="small" tone="soft" numeric>
              {clamped} of {safeMax}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    gap: space.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  track: {
    height: 8,
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: color.border,
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: color.primaryStrong,
  },
});

export default Meter;
