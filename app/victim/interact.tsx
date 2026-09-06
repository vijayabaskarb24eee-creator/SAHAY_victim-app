import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, ScrollView, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../lib/api';
import { useAudioRecorder } from '../../lib/useAudioRecorder';
import { useTranslations } from '../../lib/i18n/useTranslations';

export default function InteractScreen() {
  const router = useRouter();
  const { t } = useTranslations();
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const recorder = useAudioRecorder();

  const startRecording = async () => {
    const ok = await recorder.start();
    if (ok) router.push('/victim/recording');
    else {
      const msg = t('errors.permissionMic');
      if (typeof window !== 'undefined') window.alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  const submitText = async () => {
    if (!textInput.trim()) {
      const msg = t('errors.requiredField');
      if (typeof window !== 'undefined') window.alert(msg);
      else Alert.alert('Required', msg);
      return;
    }
    setSubmitting(true);
    await AsyncStorage.setItem('sahay_text_input', textInput.trim());
    router.push('/victim/analyzing');
    const caseStr = await AsyncStorage.getItem('sahay_case');
    const caseData = caseStr ? JSON.parse(caseStr) : null;
    const lang = await AsyncStorage.getItem('sahay_language') || 'English';
    try {
      const fd = new FormData();
      fd.append('text_input', textInput.trim());
      fd.append('language', lang);
      if (caseData?.id) fd.append('case_id', String(caseData.id));
      const res = await api.post('/api/voice/analyze', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      await AsyncStorage.setItem('sahay_result', JSON.stringify(res.data.data));
      router.replace('/victim/result');
    } catch {
      await AsyncStorage.setItem('sahay_result', JSON.stringify({ error: true }));
      router.replace('/victim/result');
    } finally { setSubmitting(false); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← {t('common.goBack')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('common.appName')}</Text>
        <Text style={styles.step}>{t('safety.stepN', { n: '4' })} / 6</Text>
      </View>
      <View style={styles.progressBar}><View style={[styles.progressFill, { width: '66%' }]} /></View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.title}>{t('interact.title')}</Text>
        <Text style={styles.subtitle}>{t('interact.subtitle')}</Text>

        <View style={styles.platformBadge}>
          <Text style={styles.platformBadgeText}>
            {Platform.OS === 'web' ? t('interact.browserMode') : t('interact.mobileMode')}
          </Text>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, mode === 'voice' && styles.tabActive]} onPress={() => setMode('voice')}>
            <Text style={[styles.tabText, mode === 'voice' && styles.tabTextActive]}>{t('interact.speakToUs')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, mode === 'text' && styles.tabActive]} onPress={() => setMode('text')}>
            <Text style={[styles.tabText, mode === 'text' && styles.tabTextActive]}>{t('interact.writeMessage')}</Text>
          </TouchableOpacity>
        </View>

        {mode === 'voice' ? (
          <View style={styles.voiceCard}>
            <Text style={styles.voiceTitle}>{t('interact.voiceRecording')}</Text>
            <Text style={styles.voiceDesc}>
              {Platform.OS === 'web' ? t('interact.micInstruction') : t('interact.micInstruction')}
            </Text>
            <TouchableOpacity style={styles.recBtn} onPress={startRecording}>
              <Text style={styles.recBtnText}>{t('interact.startRecording')}</Text>
            </TouchableOpacity>
            <View style={styles.langInfo}>
              <Text style={styles.langInfoText}>{t('interact.langHint')}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.textCard}>
            <Text style={styles.textTitle}>{t('interact.yourMessage')}</Text>
            <Text style={styles.textDesc}>{t('interact.pleaseDescribe')}</Text>
            <TextInput
              style={styles.textArea}
              value={textInput}
              onChangeText={setTextInput}
              placeholder={t('interact.pleaseDescribe')}
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.submitBtn, (!textInput.trim() || submitting) && styles.submitBtnDisabled]}
              onPress={submitText}
              disabled={!textInput.trim() || submitting}
            >
              <Text style={styles.submitBtnText}>
                {submitting ? t('common.loading') : t('interact.submitForAnalysis')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.safetyNote}>
          <Text style={styles.safetyNoteText}>{t('interact.encryptedConfidential')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { backgroundColor: '#1a4d8f', paddingTop: Platform.OS === 'web' ? 20 : 52, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { padding: 4 },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  step: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  progressBar: { height: 4, backgroundColor: '#dde3ea' },
  progressFill: { height: 4, backgroundColor: '#0f6e5c' },
  body: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  platformBadge: { backgroundColor: '#f0fdf4', borderRadius: 8, padding: 8, marginBottom: 16, borderWidth: 1, borderColor: '#86efac' },
  platformBadgeText: { fontSize: 12, color: '#15803d', textAlign: 'center', fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  tab: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#dde3ea', alignItems: 'center', backgroundColor: '#fff' },
  tabActive: { borderColor: '#1a4d8f', backgroundColor: '#e8f0fb' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#1a4d8f' },
  voiceCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#dde3ea', alignItems: 'center', marginBottom: 16 },
  voiceTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  voiceDesc: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 24, lineHeight: 19 },
  recBtn: { backgroundColor: '#1a4d8f', borderRadius: 60, width: 130, height: 130, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  recBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
  langInfo: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, width: '100%' },
  langInfoText: { fontSize: 12, color: '#15803d', textAlign: 'center' },
  textCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#dde3ea', marginBottom: 16 },
  textTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  textDesc: { fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 19 },
  textArea: { borderWidth: 1.5, borderColor: '#dde3ea', borderRadius: 10, padding: 14, fontSize: 15, color: '#111827', minHeight: 140, backgroundColor: '#f9fafb' },
  submitBtn: { backgroundColor: '#1a4d8f', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 14 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  safetyNote: { backgroundColor: '#eff6ff', borderRadius: 10, padding: 12 },
  safetyNoteText: { fontSize: 12, color: '#1d4ed8', textAlign: 'center' },
});
