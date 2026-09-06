import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../lib/api';

export default function LoginScreen() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', language: 'English' });
  const [locationStatus, setLocationStatus] = useState<'idle' | 'fetching' | 'granted' | 'denied'>('idle');
  const [locationLabel, setLocationLabel] = useState<string>('Requesting GPS location...');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Request location permission & fetch coordinates automatically on screen mount
  useEffect(() => {
    requestAndFetchLocation();
  }, []);

  const requestAndFetchLocation = async (): Promise<any> => {
    setLocationStatus('fetching');
    return new Promise((resolve) => {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            let address = `Coordinates: ${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`;
            let district = 'Chennai';
            let state = 'Tamil Nadu';

            try {
              // Attempt quick reverse geocode
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 3500);
              const r = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14`,
                { signal: controller.signal, headers: { 'User-Agent': 'SAHAY-AI/1.0' } }
              );
              clearTimeout(timer);
              if (r.ok) {
                const data = await r.json();
                if (data.display_name) address = data.display_name;
                const a = data.address || {};
                district = a.city_district || a.state_district || a.county || a.district || a.city || district;
                state = a.state || state;
              }
            } catch (_e) {}

            const locData = { latitude, longitude, district, state, address };
            await AsyncStorage.setItem('sahay_location', JSON.stringify(locData));
            setLocationStatus('granted');
            setLocationLabel(`${district}, ${state}`);
            resolve(locData);
          },
          (err) => {
            console.warn('Geolocation access denied or unavailable:', err);
            const fallbackLoc = {
              latitude: 13.0827,
              longitude: 80.2707,
              district: 'Chennai',
              state: 'Tamil Nadu',
              address: 'Chennai Central District, Tamil Nadu',
            };
            AsyncStorage.setItem('sahay_location', JSON.stringify(fallbackLoc));
            setLocationStatus('granted');
            setLocationLabel('Chennai, Tamil Nadu (Default)');
            resolve(fallbackLoc);
          },
          { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
        );
      } else {
        const fallbackLoc = {
          latitude: 13.0827,
          longitude: 80.2707,
          district: 'Chennai',
          state: 'Tamil Nadu',
          address: 'Chennai Central District, Tamil Nadu',
        };
        AsyncStorage.setItem('sahay_location', JSON.stringify(fallbackLoc));
        setLocationStatus('granted');
        setLocationLabel('Chennai, Tamil Nadu (Default)');
        resolve(fallbackLoc);
      }
    });
  };

  const submit = async () => {
    if (!form.email || !form.password) { Alert.alert('Required', 'Please enter email and password'); return; }
    setLoading(true);
    try {
      // Ensure location is fetched before completing login
      let cachedLoc: any = null;
      try {
        const locStr = await AsyncStorage.getItem('sahay_location');
        if (locStr) cachedLoc = JSON.parse(locStr);
        else cachedLoc = await requestAndFetchLocation();
      } catch (_e) {}

      let res;
      if (isRegister) {
        if (!form.name) { Alert.alert('Required', 'Please enter your name'); setLoading(false); return; }
        res = await api.post('/api/auth/register', {
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          language: form.language,
          district: cachedLoc?.district,
          state: cachedLoc?.state,
          address: cachedLoc?.address,
          latitude: cachedLoc?.latitude,
          longitude: cachedLoc?.longitude,
        });
      } else {
        res = await api.post('/api/auth/login', { email: form.email, password: form.password });
      }
      const { accessToken, user } = res.data.data;
      // Clear any previous victim's case sessions to guarantee data isolation
      await AsyncStorage.multiRemove(['sahay_case', 'sahay_safety_answer', 'sahay_new_alert_banner']);
      await AsyncStorage.setItem('sahay_token', accessToken);
      await AsyncStorage.setItem('sahay_user', JSON.stringify(user));

      // Sync location to victim profile
      if (cachedLoc) {
        try {
          await api.patch('/api/victims/location', {
            latitude: cachedLoc.latitude,
            longitude: cachedLoc.longitude,
            district: cachedLoc.district,
            state: cachedLoc.state,
            address: cachedLoc.address,
          });
        } catch (_e) {}
      }

      router.replace('/victim/dashboard');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Login failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerIcon}>🛡️</Text>
          <Text style={styles.headerTitle}>SAHAY-AI</Text>
          <Text style={styles.headerSub}>National Helpline Against Atrocities</Text>
          <Text style={styles.headerSub2}>Helpline: 14566</Text>
        </View>

        {/* Location Permission & Status Banner */}
        <TouchableOpacity
          style={styles.locationBanner}
          onPress={requestAndFetchLocation}
          activeOpacity={0.8}
        >
          <Text style={styles.locationPinIcon}>📍</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.locationTitle}>Citizen Emergency Location</Text>
            <Text style={styles.locationSubtitle}>
              {locationStatus === 'fetching' ? 'Detecting GPS coordinates...' : `Active: ${locationLabel}`}
            </Text>
          </View>
          {locationStatus === 'fetching' && <ActivityIndicator size="small" color="#1a4d8f" />}
          {locationStatus === 'granted' && (
            <View style={styles.locationCheckPill}>
              <Text style={styles.locationCheckText}>✓ GPS Ready</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isRegister ? 'Create Account' : 'Victim / Citizen Login'}</Text>
          <Text style={styles.cardSub}>{isRegister ? 'Register to access support services' : 'Sign in to access your case'}</Text>

          {isRegister && (
            <>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={v => set('name', v)} placeholder="Your full name" placeholderTextColor="#9ca3af" />
              <Text style={styles.label}>Phone Number</Text>
              <TextInput style={styles.input} value={form.phone} onChangeText={v => set('phone', v)} placeholder="10-digit mobile number" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />
              <Text style={styles.label}>Language</Text>
              <View style={styles.langRow}>
                {['English', 'Tamil', 'Hindi'].map(l => (
                  <TouchableOpacity key={l} style={[styles.langBtn, form.language === l && styles.langBtnActive]} onPress={() => set('language', l)}>
                    <Text style={[styles.langBtnText, form.language === l && styles.langBtnTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>Email Address *</Text>
          <TextInput style={styles.input} value={form.email} onChangeText={v => set('email', v)} placeholder="your@email.com" placeholderTextColor="#9ca3af" autoCapitalize="none" keyboardType="email-address" />

          <Text style={styles.label}>Password *</Text>
          <TextInput style={styles.input} value={form.password} onChangeText={v => set('password', v)} placeholder="Enter password" placeholderTextColor="#9ca3af" secureTextEntry />

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={submit} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsRegister(!isRegister)} style={styles.toggleRow}>
            <Text style={styles.toggleText}>
              {isRegister ? 'Already registered? ' : "Don't have an account? "}
              <Text style={styles.toggleLink}>{isRegister ? 'Sign In' : 'Register'}</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Emergency */}
        <View style={styles.emergencyBox}>
          <Text style={styles.emergencyTitle}>⚠️ In Immediate Danger?</Text>
          <Text style={styles.emergencyText}>Call Emergency: 112  |  Helpline: 14566</Text>
        </View>

        <Text style={styles.footer}>© Dept. of Social Justice & Empowerment, Govt. of India</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 28 },
  headerIcon: { fontSize: 40, marginBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1a4d8f', letterSpacing: 0.5 },
  headerSub: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  headerSub2: { fontSize: 13, fontWeight: '700', color: '#1a4d8f', marginTop: 2 },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  locationPinIcon: { fontSize: 24 },
  locationTitle: { fontSize: 13, fontWeight: '700', color: '#1e40af' },
  locationSubtitle: { fontSize: 11, color: '#3b82f6', marginTop: 2 },
  locationCheckPill: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  locationCheckText: { fontSize: 11, fontWeight: '700', color: '#15803d' },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#6b7280', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: '#dde3ea', borderRadius: 10, padding: 13, fontSize: 15, color: '#111827', backgroundColor: '#fff' },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  langBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#dde3ea', alignItems: 'center' },
  langBtnActive: { borderColor: '#1a4d8f', backgroundColor: '#e8f0fb' },
  langBtnText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  langBtnTextActive: { color: '#1a4d8f', fontWeight: '700' },
  btn: { backgroundColor: '#1a4d8f', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  toggleRow: { alignItems: 'center', marginTop: 16 },
  toggleText: { fontSize: 13, color: '#6b7280' },
  toggleLink: { color: '#1a4d8f', fontWeight: '700' },
  emergencyBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  emergencyTitle: { fontSize: 14, fontWeight: '700', color: '#b91c1c', marginBottom: 4 },
  emergencyText: { fontSize: 13, color: '#dc2626', fontWeight: '600' },
  footer: { textAlign: 'center', fontSize: 11, color: '#9ca3af' },
});
