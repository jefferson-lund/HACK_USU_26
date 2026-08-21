import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { color, elevation, layout, radius, space } from '@/constants/theme';
import Text from './Text';

type ButtonVariant = 'primary' | 'hero' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type ButtonSize = 'regular' | 'small';

export type ButtonProps = Omit<ComponentProps<typeof Pressable>, 'children' | 'style'> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ComponentProps<typeof Pressable>['style'];
};

export function Button({
  children,
  variant = 'primary',
  size = 'regular',
  icon,
  loading = false,
  fullWidth = false,
  disabled = false,
  style,
  ...props
}: ButtonProps) {
  const unavailable = disabled || loading;
  const filled = variant === 'primary' || variant === 'hero' || variant === 'danger';
  const textTone = filled ? 'inverse' : variant === 'quiet' ? 'soft' : 'primary';

  return (
    <Pressable
      {...props}
      disabled={unavailable}
      accessibilityRole={props.accessibilityRole ?? 'button'}
      accessibilityState={{ ...props.accessibilityState, disabled: unavailable, busy: loading }}
      style={(state) => [
        styles.base,
        styles[variant],
        size === 'small' && styles.small,
        size === 'small' && filled && variant !== 'danger' && styles.smallFilled,
        fullWidth && styles.fullWidth,
        state.pressed && !unavailable && styles.pressed,
        unavailable && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}>
      <View style={styles.content}>
        {loading ? <ActivityIndicator size="small" color={filled ? color.textOnColor : color.primaryStrong} /> : icon}
        <Text
          variant={variant === 'hero' ? 'h2' : size === 'small' ? 'small' : 'body'}
          tone={textTone}
          weight="bold"
          align="center">
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouch,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  primary: {
    backgroundColor: color.primary,
    ...elevation.medium,
  },
  hero: {
    minHeight: 56,
    backgroundColor: color.primary,
    ...elevation.medium,
  },
  secondary: {
    backgroundColor: color.surface,
    borderColor: color.primaryStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: color.danger,
  },
  quiet: {
    backgroundColor: color.surfaceMuted,
    borderColor: color.border,
  },
  small: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  smallFilled: {
    backgroundColor: color.primaryStrong,
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.48,
  },
});

export default Button;
