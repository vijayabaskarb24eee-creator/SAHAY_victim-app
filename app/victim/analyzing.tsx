import { View, Text, StyleSheet } from 'react-native';
import { useTranslations } from '../../lib/i18n/useTranslations';

export default function AnalyzingScreen() {
  const { t } = useTranslations();
  const STEPS = [
    t('analyzing.step1'), t('analyzing.step2'), t('analyzing.step3'),
    t('analyzing.step4'), t('analyzing.step5'), t('analyzing.step6'),
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('common.appName')}</Text>
        <Text style={styles.step}>{t('common.loading')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>🔍</Text>
        </View>
        <Text style={styles.title}>{t('analyzing.title')}</Text>
        <Text style={styles.subtitle}>{t('analyzing.waitMessage')}</Text>

        <View style={styles.progressBar}>
          <View style={styles.progressFill} />
        </View>

        <View style={styles.stepsList}>
          {STEPS.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepCheck}>✓</Text>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>{t('analyzing.dataSecure')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { backgroundColor: '#1a4d8f', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  step: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  iconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#e8f0fb', borderWidth: 2, borderColor: '#b8cfee', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  icon: { fontSize: 38 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 19, marginBottom: 24 },
  progressBar: { width: '100%', height: 8, backgroundColor: '#dde3ea', borderRadius: 4, overflow: 'hidden', marginBottom: 28 },
  progressFill: { width: '65%', height: 8, backgroundColor: '#1a4d8f', borderRadius: 4 },
  stepsList: { width: '100%', gap: 10, marginBottom: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepCheck: { fontSize: 14, color: '#1a4d8f', fontWeight: '700', width: 20 },
  stepText: { fontSize: 13, color: '#374151' },
  note: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, width: '100%' },
  noteText: { fontSize: 12, color: '#15803d', textAlign: 'center' },
});
