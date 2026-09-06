import { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const token = await AsyncStorage.getItem('sahay_token');
        const user = await AsyncStorage.getItem('sahay_user');
        if (token && user) {
          router.replace('/victim/dashboard');
        } else {
          router.replace('/auth/login');
        }
      } catch {
        router.replace('/auth/login');
      }
    }, 2600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>🛡️</Text>
        </View>
        <Text style={styles.title}>SAHAY-AI</Text>
        <Text style={styles.tagline}>Support  •  Safety  •  Assistance</Text>
        <Text style={styles.subtitle}>National Helpline Against Atrocities</Text>
      </View>

      <View style={styles.infoBlock}>
        <Text style={styles.infoLine}>📞  Helpline: 14566</Text>
        <Text style={styles.infoLine}>Dept. of Social Justice & Empowerment</Text>
        <Text style={styles.infoLine}>Government of India</Text>
      </View>

      {Platform.OS === 'web' && (
        <View style={styles.webBadge}>
          <Text style={styles.webBadgeText}>🖥️  Browser Mode — Desktop / Laptop / Tablet</Text>
        </View>
      )}

      <View style={styles.loadRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, { opacity: 0.3 + i * 0.35 }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a4d8f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'web' ? 0 : 40,
  },
  card: { alignItems: 'center', marginBottom: 36 },
  iconBox: {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 22,
  },
  iconText: { fontSize: 44 },
  title: { fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: 1, marginBottom: 6 },
  tagline: { fontSize: 15, color: 'rgba(255,255,255,0.82)', letterSpacing: 0.5, marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.4 },
  infoBlock: {
    alignItems: 'center', gap: 4, padding: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    width: '100%', marginBottom: 20,
  },
  infoLine: { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginBottom: 2 },
  webBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 7, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  webBadgeText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  loadRow: { flexDirection: 'row', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: 'white' },
});
