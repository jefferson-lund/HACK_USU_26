import React from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import VersionSwitch from '@/components/VersionSwitch';
import TabBarIcon from '@/components/TabBarIcon';
import { color, layout, space } from '@/constants/theme';

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: color.primaryStrong,
          tabBarInactiveTintColor: color.slateFaint,
          tabBarLabelStyle: {
            fontSize: 12,
            lineHeight: 16,
            fontWeight: '600',
            marginBottom: space.xs,
          },
          tabBarStyle: {
            height: layout.tabBarHeight,
            paddingTop: space.xs,
            paddingBottom: space.xs,
            backgroundColor: color.surface,
            borderTopColor: color.border,
          },
          // Disable the static render of the header on web
          // to prevent a hydration error in React Navigation v6.
          headerShown: useClientOnlyValue(false, true),
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Setup',
            tabBarIcon: ({ color }) => (
              <TabBarIcon name="setup" color={color} size={30} />
            ),
          }}
        />
        <Tabs.Screen
          name="track"
          options={{
            title: 'Track',
            tabBarIcon: ({ color }) => (
              <TabBarIcon name="track" color={color} size={30} />
            ),
          }}
        />
      </Tabs>
      <VersionSwitch />
    </View>
  );
}
