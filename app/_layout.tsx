import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Linking, View } from 'react-native';

import {
  handleSpotifyCallback,
  SPOTIFY_CALLBACK_SCHEME,
} from '../src/services/spotifyAuth';

export default function RootLayout() {
  // Forward Spotify OAuth deep-links from cold-start (app was not running)
  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      if (url?.startsWith(SPOTIFY_CALLBACK_SCHEME)) {
        void handleSpotifyCallback(url);
      }
    });
  }, []);

  return (
    <View className="flex-1 bg-dialed-bg">
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#050508' },
          headerTintColor: '#e8e6f3',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#050508' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}
