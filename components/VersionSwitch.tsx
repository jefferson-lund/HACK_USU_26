import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/Colors';
import { setVersion } from '@/lib/versionPreference';
import {
  LABEL,
  SiteVersion,
  hrefFor,
  tabFromPath,
  versionFromPath,
} from '@/lib/siteVersion';

const ORDER: SiteVersion[] = ['v2', 'legacy'];

/**
 * Two-segment pill, top-right on every screen of both versions.
 *
 * Mounted once per route group as a sibling of <Tabs> rather than as a
 * `headerRight`, because the tab layouts set
 * `headerShown: useClientOnlyValue(false, true)` -- on web there is no header
 * at all in the prerendered HTML, so a headerRight would pop in a frame late.
 */
export default function VersionSwitch() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const active = versionFromPath(pathname);

  const go = (next: SiteVersion) => {
    if (next === active) return;
    // Fire-and-forget: synchronous on web, cached-synchronous on native.
    void setVersion(next);
    // router.replace, never window.location. lib/database.web.ts keeps the
    // visitor's setup, activities and ratings IN MEMORY, so a hard navigation
    // would silently wipe their data mid-session.
    router.replace(hrefFor(next, tabFromPath(pathname)));
  };

  return (
    <View style={[styles.overlay, { top: insets.top + 8 }]}>
      <View
        style={styles.pill}
        accessibilityRole="radiogroup"
        accessibilityLabel="Site version">
        {ORDER.map((v) => {
          const selected = v === active;
          return (
            <Pressable
              key={v}
              onPress={() => go(v)}
              // radio rather than tab: react-native-web maps `checked` to
              // aria-checked (it drops `selected`), and the bottom tab bar
              // already owns role="tab" on this screen.
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              // react-native-web does not forward accessibilityState.checked,
              // so the web attribute is passed explicitly.
              aria-checked={selected}
              accessibilityLabel={`${LABEL[v]} version`}
              hitSlop={6}
              style={[styles.segment, selected && styles.segmentActive]}>
              <Text style={[styles.label, selected && styles.labelActive]}>
                {LABEL[v]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    right: 16,
    zIndex: 1000,
    // box-none so the overlay never swallows taps meant for the screen behind
    // it -- only the pill itself is interactive.
    pointerEvents: 'box-none',
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: Brand.white,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.chipBorder,
    padding: 3,
    gap: 2,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 8,
  },
  segment: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    minHeight: 32,
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: Brand.orange,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.inkSoft,
  },
  labelActive: {
    color: Brand.white,
  },
});
