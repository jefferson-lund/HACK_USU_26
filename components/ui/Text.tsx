import type { ComponentProps } from 'react';
import { Text as NativeText, StyleSheet, type TextStyle } from 'react-native';

import { color, type as typeScale, type TypeVariant, weight } from '@/constants/theme';

type Tone = 'default' | 'soft' | 'muted' | 'primary' | 'brand' | 'danger' | 'success' | 'inverse';
type Weight = keyof typeof weight;

export type TextProps = ComponentProps<typeof NativeText> & {
  variant?: TypeVariant;
  tone?: Tone;
  weight?: Weight;
  align?: TextStyle['textAlign'];
  numeric?: boolean;
};

const toneStyles: Record<Tone, TextStyle> = {
  default: { color: color.text },
  soft: { color: color.textSoft },
  muted: { color: color.slateFaint },
  primary: { color: color.primaryStrong },
  brand: { color: color.brand },
  danger: { color: color.danger },
  success: { color: color.successText },
  inverse: { color: color.textOnColor },
};

export function Text({
  variant = 'body',
  tone = 'default',
  weight: fontWeight,
  align,
  numeric = false,
  style,
  ...props
}: TextProps) {
  return (
    <NativeText
      {...props}
      style={[
        typeScale[variant],
        toneStyles[tone],
        fontWeight ? { fontWeight: weight[fontWeight] } : undefined,
        align ? { textAlign: align } : undefined,
        numeric ? styles.numeric : undefined,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  numeric: {
    fontVariant: ['tabular-nums'],
  },
});

export default Text;
