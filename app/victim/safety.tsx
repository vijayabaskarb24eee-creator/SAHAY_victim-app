import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../lib/api';
import { useTranslations } from '../../lib/i18n/useTranslations';
import { RiArrowLeftLine, RiPhoneFill, RiAlarmWarningFill, RiQuestionLine } from 'react-icons/ri';
import VictimBottomNav from '../../components/VictimBottomNav';

export default function SafetyScreen() {
  const router = useRouter();
  const { t, language } = useTranslations();
  const [loading, setLoading] = useState(false);

  const goEmergency = async () => {
    setLoading(true);
    try {
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
      const caseData = res.data?.data?.case || res.data?.case || res.data;
      if (caseData) {
        await AsyncStorage.setItem('sahay_case', JSON.stringify(caseData));
        await AsyncStorage.setItem('sahay_safety_answer', 'yes');
        await AsyncStorage.setItem('sahay_new_alert_banner', 'true');
        setLoading(false);
        router.push({
          pathname: '/victim/emergency-buzzer',
          params: { caseId: String(caseData.id) },
        });
        return;
      }
    } catch (_e) {}
    setLoading(false);
    router.push('/victim/emergency-buzzer');
  };

  const goUnsure = () => {
    router.push('/victim/unsure');
  };

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
        <Text style={styles.step}>{t('safety.stepN', { n: '3' })} / 4</Text>
      </View>
      <View style={styles.progressBar}><View style={[styles.progressFill, { width: '75%' }]} /></View>

      <View style={styles.body}>
        <View style={styles.contentWrap}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{t('safety.title')}</Text>
            <Text style={styles.subtitle}>{t('safety.subtitle')}</Text>
          </View>

          <View style={styles.questionCard}>
            <Text style={styles.question}>{t('safety.questionImmediateDanger')}</Text>
          </View>

          <View style={styles.optContainer}>
            <TouchableOpacity
              style={[styles.optCard, styles.optEmergency, loading && styles.optCardDisabled]}
              activeOpacity={0.85}
              onPress={goEmergency}
              disabled={loading}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                <RiAlarmWarningFill size={20} color="#b91c1c" />
                <Text style={styles.optLabelEmergency}>{t('safety.yesImmediateDangerBtn')}</Text>
              </View>
              <Text style={styles.optSubLabelEmergency}>{t('safety.goToDanger')}</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.orLabel}>{t('safety.orOption')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.optCard, styles.optUnsure, loading && styles.optCardDisabled]}
              activeOpacity={0.85}
              onPress={goUnsure}
              disabled={loading}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                <RiQuestionLine size={20} color="#0f766e" />
                <Text style={styles.optLabelUnsure}>{t('safety.iAmNotSureBtn')}</Text>
              </View>
              <Text style={styles.optSubLabelUnsure}>{t('safety.goToUnsure')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.emergencyBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
              <RiPhoneFill size={14} color="#b91c1c" />
              <Text style={styles.emergencyTitle}>{t('common.emergencyContacts')}</Text>
            </View>
            <View style={styles.contactsRow}>
              <Text style={styles.emergencyText}>{t('common.police112')}</Text>
              <Text style={styles.emergencyDot}>•</Text>
              <Text style={styles.emergencyText}>{t('common.nhaa14566')}</Text>
            </View>
          </View>
        </View>
      </View>

      <VictimBottomNav activeTab="safety" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#0f3a6d',
    paddingTop: Platform.OS === 'web' ? 24 : 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#ffffff', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },
  step: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },
  progressBar: { height: 3, backgroundColor: '#e2e8f0' },
  progressFill: { height: 3, backgroundColor: '#0f766e' },
  body: { flex: 1, padding: 20, paddingBottom: 85 },
  contentWrap: { maxWidth: 560, width: '100%', alignSelf: 'center', flex: 1, justifyContent: 'center' },
  titleBlock: { marginBottom: 20, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  questionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
    alignItems: 'center',
  },
  question: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f3a6d',
    lineHeight: 26,
    textAlign: 'center',
  },
  optContainer: { gap: 8, marginBottom: 24 },
  optCard: {
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  optEmergency: {
    backgroundColor: '#fff1f2',
    borderColor: '#e11d48',
  },
  optUnsure: {
    backgroundColor: '#ffffff',
    borderColor: '#0f3a6d',
  },
  optLabelEmergency: {
    fontSize: 17,
    fontWeight: '800',
    color: '#be123c',
    marginBottom: 4,
    textAlign: 'center',
  },
  optSubLabelEmergency: {
    fontSize: 13,
    color: '#9f1239',
    fontWeight: '500',
  },
  optLabelUnsure: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f3a6d',
    marginBottom: 4,
    textAlign: 'center',
  },
  optSubLabelUnsure: {
    fontSize: 13,
    color: '#64748b',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  orLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  optCardDisabled: { opacity: 0.6 },
  emergencyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecdd3',
    alignItems: 'center',
  },
  emergencyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9f1239',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  contactsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emergencyDot: { color: '#cbd5e1', fontSize: 14 },
  emergencyText: { fontSize: 13, fontWeight: '700', color: '#be123c' },
});
