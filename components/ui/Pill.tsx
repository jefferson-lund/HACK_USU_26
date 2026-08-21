import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { color, layout, radius, space } from '@/constants/theme';
import Text from './Text';

export type PillProps = Omit<ComponentProps<typeof Pressable>, 'children' | 'style'> & {
  children: ReactNode;
  selected?: boolean;
  removable?: boolean;
  style?: ComponentProps<typeof Pressable>['style'];
};

export function Pill({
  children,
  selected = false,
  removable = false,
  disabled,
  onPress,
  style,
  ...props
}: PillProps) {
  const unavailable = Boolean(disabled);
  const interactive = typeof onPress === 'function';

  return (
    <Pressable
      {...props}
      onPress={onPress}
      disabled={unavailable || !interactive}
      accessibilityRole={props.accessibilityRole ?? (interactive ? 'button' : 'text')}
      accessibilityState={{ ...props.accessibilityState, selected, disabled: unavailable }}
      style={(state) => [
        styles.base,
        selected && styles.selected,
        state.pressed && !unavailable && styles.pressed,
        unavailable && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}>
      <Text variant="small" weight="semibold" tone={selected ? 'inverse' : 'default'} numberOfLines={2}>
        {children}
        {removable ? '  ×' : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouch,
    maxWidth: '100%',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    backgroundColor: color.surfaceSubtle,
  },
  selected: {
    borderColor: color.primaryStrong,
    backgroundColor: color.primaryStrong,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.48,
  },
});

export default Pill;
