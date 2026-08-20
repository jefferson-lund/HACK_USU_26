import React from 'react';
import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import VersionSwitch from '@/components/VersionSwitch';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme].tint,
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: '600',
            marginBottom: 6,
          },
          tabBarStyle: {
            paddingVertical: 8,
            height: 80,
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
              <SymbolView
                name={{
                  ios: 'gear',
                  android: 'settings',
                  web: 'settings',
                }}
                tintColor={color}
                size={36}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="track"
          options={{
            title: 'Track',
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{
                  ios: 'checkmark.square',
                  android: 'check_box',
                  web: 'check_box',
                }}
                tintColor={color}
                size={36}
              />
            ),
          }}
        />
      </Tabs>
      <VersionSwitch />
    </View>
  );
}
