import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LanguageProvider } from '../lib/i18n/LanguageContext';
import { View, StyleSheet, Platform } from 'react-native';
import { useEffect } from 'react';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'sahay-desktop-mobile-frame';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            width: 100% !important;
            background-color: #0b1120 !important;
            overflow-x: hidden !important;
          }
          #root {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: flex-start !important;
            min-height: 100vh !important;
            width: 100% !important;
            background-color: #0b1120 !important;
          }
          #root > div {
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: flex-start !important;
            min-height: 100vh !important;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  return (
    <LanguageProvider>
      <StatusBar style="light" backgroundColor="#0f3a6d" />
      <View style={styles.webOuter}>
        <View style={styles.mobileContainer}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth/login" />
            <Stack.Screen name="auth/register" />
            <Stack.Screen name="victim/language" />
            <Stack.Screen name="victim/consent" />
            <Stack.Screen name="victim/safety" />
            <Stack.Screen name="victim/emergency-buzzer" />
            <Stack.Screen name="victim/unsure" />
            <Stack.Screen name="victim/interact" />
            <Stack.Screen name="victim/recording" />
            <Stack.Screen name="victim/result" />
            <Stack.Screen name="victim/dashboard" />
            <Stack.Screen name="victim/tracking" />
          </Stack>
        </View>
      </View>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  webOuter: {
    flex: 1,
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web'
      ? ({
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#0b1120',
          minHeight: '100vh',
          width: '100vw',
        } as any)
      : {}),
  },
  mobileContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#ffffff',
    ...(Platform.OS === 'web'
      ? ({
          maxWidth: 445,
          minHeight: '100vh',
          maxHeight: '100vh',
          boxShadow: '0 25px 65px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: '#1e293b',
          overflow: 'hidden',
          position: 'relative',
        } as any)
      : {}),
  },
});
