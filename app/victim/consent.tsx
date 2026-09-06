import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../lib/api';
import { useTranslations } from '../../lib/i18n/useTranslations';

export default function ConsentScreen() {
  const router = useRouter();
  const { t, language } = useTranslations();

  const giveConsent = async () => {
    try {
      await api.post('/api/victims/consent', { accepted: true, version: '1.0', language });
    } catch (_e) {}
    router.push('/victim/safety');
  };

  const decline = () => {
    const title = t('errors.consentRequired');
    const body = `${t('errors.pleaseRetry')}\n\n${t('common.police112')}  ·  ${t('common.nhaa14566')}`;
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${body}`);
    } else {
      Alert.alert(title, body, [
        { text: t('common.goBack'), onPress: () => router.back() },
        { text: t('common.ok') },
      ]);
    }
  };

  const sections = [
    { heading: 'consent.headingPrivacy', body: 'consent.paraPrivacy' },
    { heading: 'consent.headingHuman', body: 'consent.paraHuman' },
    { heading: 'consent.headingConfidential', body: 'consent.paraConfidential' },
    { heading: 'consent.headingMedical', body: 'consent.paraMedical' },
    { heading: 'consent.headingSvi', body: 'consent.paraSvi' },
    { heading: 'consent.headingRecord', body: 'consent.paraRecord' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('common.appName')}</Text>
        <Text style={styles.step}>{t('safety.stepN', { n: '2' })} / 4</Text>
      </View>
      <View style={styles.progressBar}><View style={[styles.progressFill, { width: '50%' }]} /></View>

      <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.introBlock}>
          <Text style={styles.title}>{t('consent.title')}</Text>
          <Text style={styles.subtitle}>{t('consent.subtitle')}</Text>
        </View>

        <View style={styles.consentCard}>
          {sections.map((s, i) => (
            <View key={s.heading} style={[styles.sectionItem, i < sections.length - 1 && styles.sectionBorder]}>
              <Text style={styles.sectionHeading}>{t(s.heading)}</Text>
              <Text style={styles.sectionText}>{t(s.body)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.disclaimerText}>{t('consent.byProceeding')}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnPrimary} activeOpacity={0.88} onPress={giveConsent}>
          <Text style={styles.btnPrimaryText}>{t('consent.iUnderstandConsent')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} activeOpacity={0.7} onPress={decline}>
          <Text style={styles.btnSecondaryText}>{t('common.goBack')}</Text>
        </TouchableOpacity>
      </View>
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
  body: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 28, maxWidth: 640, alignSelf: 'center', width: '100%' },
  introBlock: { marginTop: 12, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3, marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#475569', lineHeight: 20 },
  consentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionItem: { paddingVertical: 18, paddingHorizontal: 20 },
  sectionBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sectionHeading: { fontSize: 15, fontWeight: '700', color: '#0f3a6d', marginBottom: 6 },
  sectionText: { fontSize: 14, color: '#334155', lineHeight: 22 },
  disclaimerText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  footer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 10,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  btnPrimary: {
    backgroundColor: '#0f3a6d',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnSecondaryText: { color: '#475569', fontSize: 14, fontWeight: '600' },
});
