import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../lib/api';
import { useAudioRecorder } from '../../lib/useAudioRecorder';
import { useTranslations } from '../../lib/i18n/useTranslations';

export default function RecordingScreen() {
  const router = useRouter();
  const { t } = useTranslations();
  const [recTime, setRecTime] = useState(0);
  const [stopped, setStopped] = useState(false);
  const recorder = useAudioRecorder();

  useEffect(() => {
    recorder.start().then((ok) => { if (!ok) router.back(); });
    const timer = setInterval(() => setRecTime((t) => t + 1), 1000);
    return () => { clearInterval(timer); };
  }, []);

  const stopAndAnalyze = async () => {
    if (stopped) return;
    setStopped(true);
    const result = await recorder.stop();
    router.replace('/victim/analyzing');
    const caseStr = await AsyncStorage.getItem('sahay_case');
    const caseData = caseStr ? JSON.parse(caseStr) : null;
    const lang = await AsyncStorage.getItem('sahay_language') || 'English';
    try {
      const fd = new FormData();
      fd.append('language', lang);
      if (caseData?.id) fd.append('case_id', String(caseData.id));
      if (Platform.OS === 'web' && result.blob) {
        fd.append('audio', result.blob, 'recording.webm');
      } else if (result.uri) {
        fd.append('audio', { uri: result.uri, name: 'recording.m4a', type: 'audio/m4a' } as any);
      }
      const res = await api.post('/api/voice/analyze', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000,
      });
      await AsyncStorage.setItem('sahay_result', JSON.stringify(res.data.data));
      router.replace('/victim/result');
    } catch {
      await AsyncStorage.setItem('sahay_result', JSON.stringify({ error: true }));
      router.replace('/victim/result');
    }
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('common.appName')}</Text>
        <Text style={styles.platformTag}>
          {Platform.OS === 'web' ? t('interact.browserMode') : t('interact.mobileMode')}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{t('recording.title')}</Text>
        <Text style={styles.subtitle}>
          {Platform.OS === 'web' ? t('recording.browserMicInstruction') : t('recording.phoneMicInstruction')}
        </Text>

        <View style={styles.ringOuter}>
          <View style={styles.ringMiddle}>
            <View style={[styles.micBtn, stopped && styles.micBtnStopped]}>
              <Text style={styles.micIcon}>{stopped ? '⏳' : '🎤'}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.timer}>{fmt(recTime)}</Text>

        <View style={styles.liveBadge}>
          <View style={[styles.liveDot, stopped && styles.liveDotStopped]} />
          <Text style={[styles.liveText, stopped && styles.liveTextStopped]}>
            {stopped ? t('recording.processing') : t('recording.recordingInProgress')}
          </Text>
        </View>

        {!stopped && (
          <TouchableOpacity style={styles.stopBtn} onPress={stopAndAnalyze}>
            <Text style={styles.stopBtnText}>{t('recording.stopRecording')}</Text>
          </TouchableOpacity>
        )}

        {stopped && (
          <View style={styles.processingBox}>
            <Text style={styles.processingText}>{t('recording.sendingToAI')}</Text>
          </View>
        )}

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>{t('recording.tipsTitle')}</Text>
          <Text style={styles.tipText}>• {t('recording.tip1')}</Text>
          <Text style={styles.tipText}>• {t('recording.tip2')}</Text>
          <Text style={styles.tipText}>• {t('recording.tip3')}</Text>
          <Text style={styles.tipText}>• {t('recording.tip4')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: {
    backgroundColor: '#1a4d8f',
    paddingTop: Platform.OS === 'web' ? 20 : 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  platformTag: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 36, lineHeight: 19 },
  ringOuter: {
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(220,38,38,0.08)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    borderWidth: 2, borderColor: 'rgba(220,38,38,0.15)',
  },
  ringMiddle: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(220,38,38,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(220,38,38,0.2)',
  },
  micBtn: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#dc2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  micBtnStopped: { backgroundColor: '#6b7280' },
  micIcon: { fontSize: 40 },
  timer: { fontSize: 52, fontWeight: '800', color: '#dc2626', marginBottom: 10, letterSpacing: 3 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 28 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#dc2626' },
  liveDotStopped: { backgroundColor: '#6b7280' },
  liveText: { fontSize: 14, fontWeight: '700', color: '#dc2626' },
  liveTextStopped: { color: '#6b7280' },
  stopBtn: {
    backgroundColor: '#dc2626', borderRadius: 14,
    paddingHorizontal: 40, paddingVertical: 16, marginBottom: 24,
    shadowColor: '#dc2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  stopBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  processingBox: {
    backgroundColor: '#eff6ff', borderRadius: 12, padding: 14,
    marginBottom: 24, borderWidth: 1, borderColor: '#bfdbfe',
  },
  processingText: { fontSize: 14, color: '#1d4ed8', fontWeight: '600', textAlign: 'center' },
  tipBox: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, width: '100%', borderWidth: 1, borderColor: '#dde3ea' },
  tipTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  tipText: { fontSize: 12, color: '#6b7280', marginBottom: 4, lineHeight: 17 },
});
