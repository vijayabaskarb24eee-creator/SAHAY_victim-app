import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../lib/api';
import { useTranslations } from '../../lib/i18n/useTranslations';

type Mode = 'text' | 'voice';

export default function UnsureScreen() {
  const router = useRouter();
  const { t, language } = useTranslations();
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const mediaRecorderRef = useRef<any>(null);
  const recordedChunksRef = useRef<any[]>([]);

  const showMessage = (title: string, body: string, onConfirm?: () => void) => {
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${body}`);
      if (onConfirm) onConfirm();
    } else {
      Alert.alert(title, body, onConfirm ? [{ text: 'OK', onPress: onConfirm }] : undefined, { cancelable: false });
    }
  };

  const canSubmit = () => {
    if (submitting) return false;
    if (mode === 'text') return text.trim().length > 3;
    if (mode === 'voice') return !!voiceUri;
    return false;
  };

  const startRecording = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).navigator?.mediaDevices?.getUserMedia) {
        const stream = await (window as any).navigator.mediaDevices.getUserMedia({ audio: true });
        const MR = (window as any).MediaRecorder;
        if (!MR) {
          showMessage(t('errors.permissionMic'), t('errors.pleaseRetry'));
          return;
        }
        const rec = new MR(stream);
        mediaRecorderRef.current = rec;
        recordedChunksRef.current = [];
        rec.ondataavailable = (e: any) => {
          if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        rec.onstop = async () => {
          try {
            const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            setVoiceUri(url);
            (mediaRecorderRef.current as any)?.stream?.getTracks?.()?.forEach((tr: any) => tr.stop());
          } catch (_e) {}
        };
        rec.start();
        setRecording(true);
      } else {
        setRecording(true);
        setTimeout(() => {
          setRecording(false);
          setVoiceUri('placeholder://local-audio-' + Date.now() + '.webm');
        }, 1500);
      }
    } catch (_e) {
      showMessage(t('errors.permissionMic'), t('errors.pleaseRetry'));
    }
  };

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && typeof mediaRecorderRef.current.stop === 'function') {
        mediaRecorderRef.current.stop();
      }
    } catch (_e) {}
    setRecording(false);
  };

  const toggleRecording = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  const clearVoice = () => {
    setVoiceUri(null);
    recordedChunksRef.current = [];
  };

  const finishSubmit = async (caseData: any) => {
    if (caseData) {
      await AsyncStorage.setItem('sahay_case', JSON.stringify(caseData));
      await AsyncStorage.setItem('sahay_safety_answer', 'unsure');
      await AsyncStorage.setItem('sahay_new_alert_banner', 'true');
    }
    router.replace('/victim/tracking');
  };

  const submit = async () => {
    if (!canSubmit()) {
      showMessage(t('errors.requiredField'), t('errors.pleaseRetry'));
      return;
    }
    setSubmitting(true);
    let caseData: any = null;
    try {
      const payload: any = {
        channel: mode === 'voice' ? 'voice' : 'text',
        language,
        incident_type: 'Unsure Report',
        is_emergency: false,
        priority: 'MODERATE',
        description: mode === 'text' ? text.trim() : 'Voice submission provided by citizen',
      };
      const res = await api.post('/api/cases', payload);
      caseData = res.data?.data?.case || res.data?.case || res.data;

      if (mode === 'voice' && voiceUri && caseData?.id) {
        try {
          const fd = new FormData();
          if (typeof window !== 'undefined' && voiceUri.startsWith('blob:')) {
            const blobFetch = await fetch(voiceUri);
            const blob = await blobFetch.blob();
            fd.append('audio', blob, `unsure_${caseData.id}.webm`);
          } else {
            fd.append('audio', new Blob(['audio'], { type: 'audio/webm' }), `unsure_${caseData.id}.webm`);
          }
          fd.append('caseId', String(caseData.id));
          await api.post('/api/messages/voice', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (_e) {}
      } else if (mode === 'text' && text.trim() && caseData?.id) {
        try {
          await api.post('/api/messages/text', {
            caseId: caseData.id,
            message: text.trim(),
          });
        } catch (_e) {}
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || t('errors.submissionFailed');
      showMessage(t('errors.caseCreationFailed'), msg);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    finishSubmit(caseData);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('common.appName')}</Text>
        <Text style={styles.step}>{t('safety.stepN', { n: '4' })} / 4</Text>
      </View>
      <View style={styles.progressBar}><View style={[styles.progressFill, { width: '100%' }]} /></View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.title}>{t('unsure.title')}</Text>
        <Text style={styles.subtitle}>{t('unsure.subtitle')}</Text>
        <Text style={styles.question}>{t('unsure.question')}</Text>
        <Text style={styles.shareHint}>{t('unsure.shareDetails')}</Text>

        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.tab, mode === 'text' && styles.tabActive]}
            onPress={() => setMode('text')}
          >
            <Text style={[styles.tabText, mode === 'text' && styles.tabTextActive]}>{t('unsure.chooseText')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'voice' && styles.tabActive]}
            onPress={() => setMode('voice')}
          >
            <Text style={[styles.tabText, mode === 'voice' && styles.tabTextActive]}>{t('unsure.chooseVoice')}</Text>
          </TouchableOpacity>
        </View>

        {mode === 'text' ? (
          <View style={styles.panel}>
            <TextInput
              style={styles.textarea}
              placeholder={t('unsure.textPlaceholder')}
              placeholderTextColor="#9ca3af"
              multiline
              value={text}
              onChangeText={setText}
              maxLength={5000}
            />
            <Text style={styles.counter}>{text.length}/5000</Text>
          </View>
        ) : (
          <View style={styles.panel}>
            <Text style={styles.voiceHint}>{t('unsure.voiceHint')}</Text>
            <TouchableOpacity
              style={[styles.recordBtn, recording && styles.recordBtnRecording]}
              onPress={toggleRecording}
            >
              <Text style={styles.recordBtnText}>
                {recording ? t('recording.stopRecording') : t('interact.startRecording')}
              </Text>
              {recording && <Text style={styles.recordingPulse}>● {t('recording.recordingInProgress')}</Text>}
            </TouchableOpacity>
            {voiceUri && !recording && (
              <View style={styles.voicePreview}>
                <Text style={styles.voicePreviewText}>🎙️ {t('interact.voiceRecording')} ✓</Text>
                <TouchableOpacity onPress={clearVoice}>
                  <Text style={styles.clearVoice}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, !canSubmit() && styles.btnDisabled]}
          disabled={!canSubmit() || submitting}
          onPress={submit}
        >
          <Text style={styles.btnText}>
            {submitting ? t('unsure.submitting') : t('unsure.submitResponse')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← {t('common.goBack')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { backgroundColor: '#1a4d8f', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  step: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  progressBar: { height: 4, backgroundColor: '#dde3ea' },
  progressFill: { height: 4, backgroundColor: '#0f6e5c' },
  body: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 18 },
  question: { fontSize: 17, fontWeight: '700', color: '#1a4d8f', marginBottom: 6 },
  shareHint: { fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 19 },
  modeTabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#dde3ea', backgroundColor: '#fff', alignItems: 'center' },
  tabActive: { borderColor: '#1a4d8f', backgroundColor: '#e8f0fb' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#1a4d8f' },
  panel: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#dde3ea', marginBottom: 16 },
  textarea: {
    minHeight: 160,
    textAlignVertical: 'top',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  counter: { marginTop: 6, textAlign: 'right', fontSize: 11, color: '#9ca3af' },
  voiceHint: { fontSize: 13, color: '#6b7280', marginBottom: 12, lineHeight: 19 },
  recordBtn: { padding: 18, borderRadius: 12, backgroundColor: '#d97706', alignItems: 'center' },
  recordBtnRecording: { backgroundColor: '#b91c1c' },
  recordBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  recordingPulse: { color: '#fee2e2', fontSize: 12, marginTop: 4, fontWeight: '600' },
  voicePreview: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' },
  voicePreviewText: { fontSize: 13, fontWeight: '600', color: '#854d0e' },
  clearVoice: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  btn: { backgroundColor: '#1a4d8f', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#9ca3af' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backBtn: { marginTop: 12, alignItems: 'center', padding: 10 },
  backBtnText: { color: '#6b7280', fontSize: 14, fontWeight: '600' },
});
