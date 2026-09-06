import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslations } from '../../lib/i18n/useTranslations';
import { Language } from '../../lib/i18n/translations';

const LANG_NATIVE: Record<Language, string> = {
  English: 'English',
  Tamil: 'தமிழ்',
  Hindi: 'हिन्दी',
  Telugu: 'తెలుగు',
  Kannada: 'ಕನ್ನಡ',
  Malayalam: 'മലയാളം',
  Bengali: 'বাংলা',
  Marathi: 'मराठी',
};

export default function LanguageScreen() {
  const router = useRouter();
  const { language, setLanguage, t, SUPPORTED_LANGS } = useTranslations();

  useEffect(() => {}, []);

  const proceed = () => {
    router.push('/victim/consent');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('common.appName')}</Text>
        <Text style={styles.step}>{t('safety.stepN', { n: '1' })} / 6</Text>
      </View>
      <View style={styles.progressBar}><View style={[styles.progressFill, { width: '16%' }]} /></View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.title}>{t('language.title')}</Text>
        <Text style={styles.subtitle}>{t('language.subtitle')}</Text>
        <Text style={styles.heading}>{t('language.selectYourLanguage')}</Text>
        <Text style={styles.hint}>{t('language.chooseLanguage')}</Text>

        <View style={styles.grid}>
          {(SUPPORTED_LANGS as readonly Language[]).map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[styles.langCard, language === lang && styles.langCardActive]}
              onPress={() => setLanguage(lang)}
            >
              {language === lang && <Text style={styles.checkIcon}>✓ </Text>}
              <View style={{ flex: 1 }}>
                <Text style={[styles.langLabel, language === lang && styles.langLabelActive]}>{lang}</Text>
                <Text style={[styles.langNative, language === lang && styles.langNativeActive]}>{LANG_NATIVE[lang]}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.persistHint}>{t('language.persistHint')}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btn} onPress={proceed}>
          <Text style={styles.btnText}>{t('common.continue')} →</Text>
        </TouchableOpacity>
      </View>
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
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 22 },
  heading: { fontSize: 17, fontWeight: '700', color: '#1a4d8f', marginBottom: 6 },
  hint: { fontSize: 13, color: '#6b7280', marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  langCard: { width: '47%', padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#dde3ea', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center' },
  langCardActive: { borderColor: '#1a4d8f', backgroundColor: '#e8f0fb' },
  checkIcon: { color: '#1a4d8f', fontWeight: '700', fontSize: 14 },
  langLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  langLabelActive: { color: '#1a4d8f' },
  langNative: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  langNativeActive: { color: '#1a4d8f', opacity: 0.75 },
  persistHint: { fontSize: 12, color: '#9ca3af', marginTop: 6, textAlign: 'center' },
  footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#dde3ea' },
  btn: { backgroundColor: '#1a4d8f', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
