import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { color, layout, space } from '@/constants/theme';
import Text from './Text';

export type SectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  quiet?: boolean;
};

export function Section({
  title,
  description,
  children,
  action,
  collapsible = false,
  defaultExpanded = true,
  expanded: controlledExpanded,
  onExpandedChange,
  quiet = false,
}: SectionProps) {
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);
  const expanded = controlledExpanded ?? uncontrolledExpanded;

  const toggle = () => {
    if (!collapsible) return;
    const next = !expanded;
    if (controlledExpanded === undefined) setUncontrolledExpanded(next);
    onExpandedChange?.(next);
  };

  const heading = (
    <View style={styles.headingCopy}>
      <View style={styles.titleRow}>
        <Text variant="h2" tone={quiet ? 'soft' : 'default'}>
          {title}
        </Text>
        {collapsible ? (
          <Text variant="body" tone="soft" accessibilityElementsHidden>
            {expanded ? '−' : '+'}
          </Text>
        ) : null}
      </View>
      {description ? (
        <Text variant="small" tone="soft">
          {description}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        {collapsible ? (
          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={`${title}, ${expanded ? 'expanded' : 'collapsed'}`}
            style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
            {heading}
          </Pressable>
        ) : (
          heading
        )}
        {action}
      </View>
      {expanded || !collapsible ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    gap: space.md,
  },
  header: {
    minHeight: layout.minTouch,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headingCopy: {
    flex: 1,
    minWidth: 180,
    gap: space.xxs,
  },
  toggle: {
    minHeight: layout.minTouch,
    flex: 1,
    justifyContent: 'center',
    borderRadius: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  content: {
    width: '100%',
    gap: space.md,
  },
  pressed: {
    backgroundColor: color.surfaceMuted,
  },
});

export default Section;
