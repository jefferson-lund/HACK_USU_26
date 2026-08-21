import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { color, elevation, radius, space } from '@/constants/theme';

type CardTone = 'default' | 'info' | 'quiet';

export type CardProps = ComponentProps<typeof View> & {
  children: ReactNode;
  busy?: boolean;
  tone?: CardTone;
  padded?: boolean;
};

export function Card({
  children,
  busy = false,
  tone = 'default',
  padded = true,
  style,
  ...props
}: CardProps) {
  return (
    <View
      {...props}
      accessibilityState={{ ...props.accessibilityState, busy }}
      style={[
        styles.base,
        tone === 'info' && styles.info,
        tone === 'quiet' && styles.quiet,
        padded && styles.padded,
        style,
      ]}>
      <View style={busy ? styles.busyContent : undefined}>{children}</View>
      {busy ? (
        <View style={styles.spinner} pointerEvents="none">
          <ActivityIndicator color={color.primaryStrong} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    ...elevation.low,
  },
  padded: {
    padding: space.lg,
  },
  info: {
    backgroundColor: color.surfaceInfo,
    borderColor: color.primary,
  },
  quiet: {
    backgroundColor: color.surfaceMuted,
    borderColor: color.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  busyContent: {
    opacity: 0.45,
  },
  spinner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Card;
