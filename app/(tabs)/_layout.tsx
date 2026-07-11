import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { loadUserProfile } from '../../src/services/userProfile';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IoniconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabsLayout() {
  // Onboarding gate — until calibration exists, the app routes to /onboarding.
  const [status, setStatus] = useState<'loading' | 'calibrated' | 'new'>('loading');

  useEffect(() => {
    loadUserProfile().then((profile) => setStatus(profile ? 'calibrated' : 'new'));
  }, []);

  if (status === 'loading') {
    return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
  }
  if (status === 'new') {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
          height: 82,
          paddingBottom: 24,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#7c5cff',
        tabBarInactiveTintColor: '#3d3850',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.4,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Focus',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="radio-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="settings-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
