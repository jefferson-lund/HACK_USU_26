import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import LaserDinosaur from '@/components/LaserDinosaur';
import Text from '@/components/ui/Text';
import { space } from '@/constants/theme';

export type WordmarkProps = {
  size?: 'lg' | 'sm';
  align?: 'left' | 'center';
};

export function Wordmark({ size = 'lg', align = 'center' }: WordmarkProps) {
  const [tapCount, setTapCount] = useState(0);
  const [showDinos, setShowDinos] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handlePress = () => {
    const nextCount = tapCount + 1;
    setTapCount(nextCount);
    if (nextCount >= 5) {
      setShowDinos(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setShowDinos(false);
        setTapCount(0);
      }, 3500);
    }
  };

  return (
    <View style={[styles.wrapper, align === 'center' ? styles.center : styles.left]}>
      {showDinos ? (
        <>
          <LaserDinosaur key="dino1" />
          <LaserDinosaur key="dino2" />
          <LaserDinosaur key="dino3" />
        </>
      ) : null}
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="wohl"
        hitSlop={space.xs}
        style={({ pressed }) => pressed && styles.pressed}>
        <Text variant={size === 'lg' ? 'display' : 'h1'} tone="brand" weight="bold">
          wohl
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    pointerEvents: 'box-none',
  },
  center: {
    alignItems: 'center',
  },
  left: {
    alignItems: 'flex-start',
  },
  pressed: {
    opacity: 0.75,
  },
});

export default Wordmark;
