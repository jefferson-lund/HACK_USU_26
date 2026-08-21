import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { alpha, color, radius, space } from '@/constants/theme';
import Text from './Text';

type CalloutTone = 'info' | 'danger' | 'success' | 'neutral';

export type CalloutProps = {
  children: ReactNode;
  title?: string;
  tone?: CalloutTone;
};

export function Callout({ children, title, tone = 'info' }: CalloutProps) {
  const textTone = tone === 'danger' ? 'danger' : tone === 'success' ? 'success' : 'default';

  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      style={[
        styles.base,
        tone === 'danger' && styles.danger,
        tone === 'success' && styles.success,
        tone === 'neutral' && styles.neutral,
      ]}>
      {title ? (
        <Text variant="small" weight="bold" tone={textTone}>
          {title}
        </Text>
      ) : null}
      <Text variant="small" tone={textTone}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    gap: space.xxs,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.primary,
    backgroundColor: color.surfaceInfo,
  },
  danger: {
    borderColor: color.danger,
    backgroundColor: alpha.danger15,
  },
  success: {
    borderColor: color.success,
    backgroundColor: alpha.successSurface60,
  },
  neutral: {
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceMuted,
  },
});

export default Callout;
