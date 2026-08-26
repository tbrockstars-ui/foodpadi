import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import { GuestSessionProvider } from './src/auth/GuestSessionContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <GuestSessionProvider>
          <StatusBar style="auto" />
          <RootNavigator />
        </GuestSessionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
