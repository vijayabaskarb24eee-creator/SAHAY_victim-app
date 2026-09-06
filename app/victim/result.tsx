import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslations } from '../../lib/i18n/useTranslations';

export default function ResultScreen() {
  const router = useRouter();
  const { t } = useTranslations();
  const [result, setResult] = useState<any>(null);
  const [caseData, setCaseData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const r = await AsyncStorage.getItem('sahay_result');
      const c = await AsyncStorage.getItem('sahay_case');
      if (r) setResult(JSON.parse(r));
      if (c) setCaseData(JSON.parse(c));
    })();
  }, []);

  const isEmergency = caseData?.is_emergency || result?.assessment?.emergency_flag || result?.emergency;
  const hasError = result?.error;
  const caseNumber = caseData?.case_number || result?.case_number || t('result.caseNumberPlaceholder');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('common.appName')}</Text>
        <Text style={styles.step}>{t('safety.stepN', { n: '5' })} / 6</Text>
      </View>
      <View style={styles.progressBar}><View style={[styles.progressFill, { width: '83%' }]} /></View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 32 }}>
        {hasError ? (
          <View style={[styles.section, styles.sectionDefault]}>
            <Text style={styles.sectionTitle}>{t('result.errorTitle')}</Text>
            <Text style={styles.sectionDesc}>{t('result.errorMessage')}</Text>
          </View>
        ) : isEmergency ? (
          <View style={[styles.section, styles.sectionEmergency]}>
            <Text style={[styles.sectionTitle, { color: '#b91c1c' }]}>{t('result.emergencyTitle')}</Text>
            <Text style={styles.sectionDesc}>{t('result.emergencyMessage')}</Text>
            <View style={styles.emergencyContacts}>
              <Text style={styles.emergencyContactTitle}>{t('common.emergencyContacts')}</Text>
              <Text style={styles.emergencyContactText}>{t('common.police112')}</Text>
              <Text style={styles.emergencyContactText}>{t('common.nhaa14566')}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.section, styles.sectionSuccess]}>
            <Text style={[styles.sectionTitle, { color: '#15803d' }]}>{t('result.successTitle')}</Text>
            <Text style={styles.sectionDesc}>{t('result.successMessage')}</Text>
          </View>
        )}

        <View style={styles.caseBox}>
          <Text style={styles.caseLabel}>{t('result.caseReference')}</Text>
          <Text style={styles.caseNumber}>{caseNumber}</Text>
          <Text style={styles.caseHint}>{t('result.saveHint')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('result.whatHappensNext')}</Text>
          <Text style={styles.nextStep}>{t('result.stepCaseRecorded')}</Text>
          <Text style={styles.nextStep}>{t('result.stepOfficerReview')}</Text>
          <Text style={styles.nextStep}>{t('result.stepSupportRecommended')}</Text>
          <Text style={styles.nextStep}>{t('result.stepFollowupContacted')}</Text>
          <Text style={styles.nextStep}>{t('result.stepConfidential')}</Text>
        </View>

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>{t('result.aiDisclaimer')}</Text>
        </View>

        <TouchableOpacity style={styles.btn} onPress={() => router.push('/victim/tracking')}>
          <Text style={styles.btnText}>{t('result.trackMyCase')} →</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnOutline} onPress={async () => {
          await AsyncStorage.multiRemove(['sahay_result', 'sahay_case', 'sahay_safety_answer']);
          router.replace('/victim/language');
        }}>
          <Text style={styles.btnOutlineText}>{t('result.submitAnotherCase')}</Text>
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
  section: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: '#dde3ea' },
  sectionEmergency: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  sectionSuccess: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  sectionDefault: { backgroundColor: '#fff7ed', borderColor: '#fdba74' },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8, textAlign: 'center' },
  sectionDesc: { fontSize: 14, color: '#374151', textAlign: 'center', lineHeight: 20 },
  emergencyContacts: { marginTop: 16, backgroundColor: '#fee2e2', borderRadius: 10, padding: 14, width: '100%' },
  emergencyContactTitle: { fontSize: 13, fontWeight: '700', color: '#b91c1c', marginBottom: 6 },
  emergencyContactText: { fontSize: 14, fontWeight: '700', color: '#dc2626', marginBottom: 4 },
  caseBox: { backgroundColor: '#e8f0fb', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#b8cfee' },
  caseLabel: { fontSize: 12, fontWeight: '700', color: '#1a4d8f', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  caseNumber: { fontSize: 24, fontWeight: '800', color: '#1a4d8f', letterSpacing: 1, marginBottom: 6 },
  caseHint: { fontSize: 12, color: '#6b7280', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#dde3ea' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  nextStep: { fontSize: 14, color: '#374151', marginBottom: 8, lineHeight: 20 },
  disclaimerBox: { backgroundColor: '#eff6ff', borderRadius: 10, padding: 14, marginBottom: 16 },
  disclaimerText: { fontSize: 13, color: '#1d4ed8', lineHeight: 19, textAlign: 'center' },
  btn: { backgroundColor: '#1a4d8f', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: { borderWidth: 1.5, borderColor: '#1a4d8f', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnOutlineText: { color: '#1a4d8f', fontSize: 15, fontWeight: '600' },
});
