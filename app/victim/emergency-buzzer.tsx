import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Animated, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../lib/api';
import { useTranslations } from '../../lib/i18n/useTranslations';
import { RiArrowLeftLine, RiPhoneFill } from 'react-icons/ri';
import VictimBottomNav from '../../components/VictimBottomNav';

const HOLD_DURATION_MS = 3000;

export default function EmergencyBuzzerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t, language } = useTranslations();
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startRef = useRef<number>(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const showMessage = (title: string, body: string, onConfirm?: () => void) => {
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${body}`);
      if (onConfirm) onConfirm();
    } else {
      Alert.alert(title, body, onConfirm ? [{ text: 'OK', onPress: onConfirm }] : undefined, { cancelable: false });
    }
  };

  const submitEmergency = async () => {
    if (submitting || triggered) return;
    setSubmitting(true);
    setTriggered(true);
    let caseData: any = null;
    try {
      if (params.caseId) {
        try {
          const res = await api.get(`/api/cases/${params.caseId}`);
          caseData = res.data?.data?.case;
        } catch (_e) {}
      }
      // If no active case passed via params, create a brand new emergency complaint
      if (!caseData?.id) {
        let locData: any = {};
        try {
          const lStr = await AsyncStorage.getItem('sahay_location');
          if (lStr) locData = JSON.parse(lStr);
        } catch (_e) {}

        const res = await api.post('/api/cases', {
          channel: 'emergency_buzzer',
          language,
          incident_type: 'Immediate Danger',
          is_emergency: true,
          priority: 'EMERGENCY',
          district: locData.district,
          state: locData.state,
          address: locData.address,
          latitude: locData.latitude,
          longitude: locData.longitude,
        });
        caseData = res.data?.data?.case || res.data?.case || res.data;
      }
      if (caseData) {
        await AsyncStorage.setItem('sahay_case', JSON.stringify(caseData));
        await AsyncStorage.setItem('sahay_safety_answer', 'yes');
        await AsyncStorage.setItem('sahay_new_alert_banner', 'true');
      }
    } catch (_e) {}
    setSubmitting(false);

    // Transition directly to the Emergency Tracker & Live Communication Screen with caseId
    if (caseData?.id) {
      router.replace({ pathname: '/victim/tracking', params: { caseId: String(caseData.id) } });
    } else {
      router.replace('/victim/tracking');
    }
  };

  const onPressIn = () => {
    if (submitting || triggered) return;
    setHolding(true);
    startRef.current = Date.now();
    progressAnim.setValue(0);
    animRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: HOLD_DURATION_MS,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) submitEmergency();
    });
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const p = Math.min(1, elapsed / HOLD_DURATION_MS);
      setProgress(p);
      if (p >= 1 && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, 25);
  };

  const onPressOut = () => {
    if (!holding || submitting || triggered) return;
    if (animRef.current) animRef.current.stop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setHolding(false);
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
    const elapsed = Date.now() - startRef.current;
    if (elapsed < HOLD_DURATION_MS) {
      setProgress(0);
    }
  };

  const size = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const ringColor = progressAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#f43f5e', '#e11d48', '#9f1239'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push('/victim/dashboard')}
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 6 }}
        >
          <RiArrowLeftLine size={16} color="#ffffff" style={{ marginRight: 4 }} />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('common.appName')}</Text>
        <Text style={styles.step}>{t('safety.stepN', { n: '4' })} / 4</Text>
      </View>
      <View style={styles.progressBar}><View style={[styles.progressFill, { width: '100%' }]} /></View>

      <View style={styles.body}>
        <View style={styles.contentWrap}>
          <Text style={styles.questionHeading}>{t('safety.questionImmediateDanger')}</Text>
          <Text style={styles.title}>{t('safety.yesImmediateDangerBtn')}</Text>
          <Text style={styles.subtitle}>{t('emergencyBuzzer.pressAndHoldFor3Sec')}</Text>

          <View style={styles.buzzerWrap}>
            <View style={styles.ringOuter}>
              <Animated.View style={[styles.ringInner, { width: size, height: size, backgroundColor: ringColor }]} />
              <TouchableOpacity
                activeOpacity={0.88}
                style={[styles.buzzer, holding && styles.buzzerHolding]}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                disabled={submitting || triggered}
              >
                <Text style={styles.buzzerText}>
                  {holding ? `${Math.round(progress * 100)}%` : triggered ? '✓' : submitting ? '...' : 'SOS'}
                </Text>
                <Text style={styles.buzzerSub}>
                  {!triggered && !submitting ? t('emergencyBuzzer.holdProgressLabel') : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.feedbackContainer}>
            {holding && progress < 1 && (
              <Text style={styles.progressHintActive}>{t('emergencyBuzzer.releasing')}</Text>
            )}
            {!holding && progress === 0 && (
              <Text style={styles.holdInstruction}>{t('emergencyBuzzer.pressAndHoldFor3Sec')}</Text>
            )}
            {!holding && progress > 0 && progress < 1 && (
              <Text style={styles.progressHintWarning}>
                {t('emergencyBuzzer.releasedTooSoon')}. {t('emergencyBuzzer.tryAgainHint')}.
              </Text>
            )}
          </View>

          <View style={styles.emergencyBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
              <RiPhoneFill size={14} color="#b91c1c" />
              <Text style={styles.emergencyTitle}>{t('tracker.needImmediateHelp')}</Text>
            </View>
            <View style={styles.contactsRow}>
              <Text style={styles.emergencyText}>{t('common.police112')}</Text>
              <Text style={styles.emergencyDot}>•</Text>
              <Text style={styles.emergencyText}>{t('common.nhaa14566')}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>← {t('common.goBack')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <VictimBottomNav activeTab="sos" caseId={params.caseId as string} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff1f2' },
  header: {
    backgroundColor: '#9f1239',
    paddingTop: Platform.OS === 'web' ? 24 : 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#ffffff', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },
  step: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },
  progressBar: { height: 3, backgroundColor: '#fecdd3' },
  progressFill: { height: 3, backgroundColor: '#be123c' },
  body: { flex: 1, padding: 20, paddingBottom: 85, justifyContent: 'center' },
  contentWrap: { maxWidth: 500, width: '100%', alignSelf: 'center', alignItems: 'center' },
  questionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9f1239',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#881337', marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#9f1239', marginBottom: 24, textAlign: 'center' },
  buzzerWrap: { alignItems: 'center', justifyContent: 'center', height: 260, width: 260, marginVertical: 8 },
  ringOuter: {
    width: 250,
    height: 250,
    borderRadius: 125,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 8,
    borderColor: '#fecdd3',
    overflow: 'hidden',
    backgroundColor: '#ffe4e6',
    position: 'relative',
  },
  ringInner: {
    position: 'absolute',
    borderRadius: 125,
  },
  buzzer: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#e11d48',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#881337',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
    borderWidth: 5,
    borderColor: '#fda4af',
  },
  buzzerHolding: {
    transform: [{ scale: 0.96 }],
    backgroundColor: '#be123c',
    borderColor: '#fb7185',
  },
  buzzerText: { color: '#ffffff', fontSize: 36, fontWeight: '900', letterSpacing: 1 },
  buzzerSub: {
    color: '#ffe4e6',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 8,
    fontWeight: '600',
  },
  feedbackContainer: { minHeight: 32, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  holdInstruction: { fontSize: 13, color: '#9f1239', fontWeight: '500' },
  progressHintActive: { fontSize: 13, color: '#be123c', fontWeight: '700' },
  progressHintWarning: { fontSize: 13, color: '#b91c1c', fontWeight: '600', textAlign: 'center' },
  emergencyBox: {
    marginTop: 20,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
    width: '100%',
    alignItems: 'center',
  },
  emergencyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9f1239',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  contactsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emergencyDot: { color: '#fda4af', fontSize: 14 },
  emergencyText: { fontSize: 13, fontWeight: '700', color: '#be123c' },
  backBtn: { marginTop: 16, padding: 10 },
  backBtnText: { color: '#9f1239', fontSize: 14, fontWeight: '600' },
});
