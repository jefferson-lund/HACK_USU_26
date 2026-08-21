import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/theme';
import Pill from './Pill';

export type PillOption<T extends string | number> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
};

export type PillGroupProps<T extends string | number> = {
  options: PillOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  label: string;
  allowClear?: boolean;
  compact?: boolean;
};

export function PillGroup<T extends string | number>({
  options,
  value,
  onChange,
  label,
  allowClear = false,
  compact = false,
}: PillGroupProps<T>) {
  return (
    <View
      style={[styles.group, compact && styles.compact]}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pill
            key={String(option.value)}
            selected={selected}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            onPress={() => onChange(selected && allowClear ? null : option.value)}>
            {option.label}
          </Pill>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  compact: {
    gap: space.xxs,
  },
});

export default PillGroup;
