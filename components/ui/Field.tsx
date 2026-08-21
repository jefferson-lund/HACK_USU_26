import { useId, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextStyle } from 'react-native';

import { color, layout, radius, space, type as typeScale } from '@/constants/theme';
import Text from './Text';

export type FieldProps = Omit<ComponentProps<typeof TextInput>, 'style'> & {
  label: string;
  hint?: string;
  error?: string | null;
  trailing?: ReactNode;
  inputStyle?: StyleProp<TextStyle>;
};

export function Field({
  label,
  hint,
  error,
  trailing,
  inputStyle,
  nativeID,
  accessibilityLabelledBy,
  ...inputProps
}: FieldProps) {
  const generatedId = useId().replace(/:/g, '');
  const inputId = nativeID ?? `field-${generatedId}`;
  const labelId = `${inputId}-label`;

  return (
    <View style={styles.field}>
      <Text nativeID={labelId} variant="small" weight="semibold">
        {label}
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          {...inputProps}
          nativeID={inputId}
          accessibilityLabelledBy={accessibilityLabelledBy ?? labelId}
          placeholderTextColor={color.textSoft}
          style={[styles.input, trailing ? styles.inputWithTrailing : undefined, inputStyle]}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {error ? (
        <Text variant="small" tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" tone="soft">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    width: '100%',
    gap: space.xs,
  },
  inputRow: {
    position: 'relative',
    width: '100%',
  },
  input: {
    ...typeScale.body,
    minHeight: layout.minTouch + 8,
    width: '100%',
    borderWidth: 1,
    borderColor: color.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: color.surfaceMuted,
    color: color.text,
  },
  inputWithTrailing: {
    paddingRight: 60,
  },
  trailing: {
    position: 'absolute',
    right: space.xxs,
    top: space.xxs,
    bottom: space.xxs,
    justifyContent: 'center',
  },
});

export default Field;
