import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../lib/api';
import { useTranslations } from '../../lib/i18n/useTranslations';
import {
  RiShieldCheckFill,
  RiShieldCheckLine,
  RiTranslate2,
  RiLogoutBoxRLine,
  RiShieldUserLine,
  RiPhoneLine,
  RiPhoneFill,
  RiMailLine,
  RiMapPin2Line,
  RiAlarmWarningFill,
  RiAlarmWarningLine,
  RiFileShieldLine,
  RiFileList3Line,
  RiTimeLine,
  RiCheckboxCircleLine,
  RiArrowRightLine,
  RiArrowRightSLine,
  RiRefreshLine,
} from 'react-icons/ri';
import VictimBottomNav from '../../components/VictimBottomNav';

const formatISTDateTime = (isoString?: string | Date) => {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return (
      d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }) + ' IST'
    );
  } catch (_e) {
    return String(isoString);
  }
};

const getStatusBadgeStyle = (status: string) => {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'EMERGENCY':
    case 'CRITICAL':
      return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5', label: 'EMERGENCY', isEmergency: true };
    case 'UNDER_REVIEW':
    case 'NEW':
      return { bg: '#fef3c7', text: '#b45309', border: '#fcd34d', label: 'UNDER REVIEW', isEmergency: false };
    case 'SUPPORT_ASSIGNED':
    case 'FOLLOW_UP':
      return { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd', label: 'SUPPORT DISPATCHED', isEmergency: false };
    case 'RESOLVED':
    case 'CLOSED':
      return { bg: '#dcfce7', text: '#15803d', border: '#86efac', label: 'RESOLVED', isEmergency: false };
    default:
      return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', label: s, isEmergency: false };
  }
};

export default function VictimDashboardScreen() {
  const router = useRouter();
  const { t, language } = useTranslations();

  const [victim, setVictim] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ total: number; active: number; resolved: number; latest_active: any }>({
    total: 0,
    active: 0,
    resolved: 0,
    latest_active: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggeringAlert, setTriggeringAlert] = useState(false);

  // Pulse animation for active emergency indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const [locFetching, setLocFetching] = useState(false);

  // Automatically fetch complete device location and synchronize with backend
  const fetchAndSyncLocation = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocFetching(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let address = `Coordinates: ${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`;
        let district = 'Chennai';
        let state = 'Tamil Nadu';

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4000);
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16`,
            { signal: controller.signal, headers: { 'User-Agent': 'SAHAY-AI-Portal/1.0' } }
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
        setVictim((prev: any) => ({
          ...(prev || {}),
          latitude,
          longitude,
          district,
          state,
          address,
        }));

        try {
          await api.patch('/api/victims/location', locData);
        } catch (_e) {}
        setLocFetching(false);
      },
      (err) => {
        console.warn('Geolocation capture:', err);
        setLocFetching(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [profileRes, alertsRes] = await Promise.all([
        api.get('/api/victims/me').catch(() => null),
        api.get('/api/victims/alerts').catch(() => null),
      ]);

      if (profileRes?.data?.data) {
        const vData = profileRes.data.data;
        setVictim(vData);
        await AsyncStorage.setItem('sahay_user', JSON.stringify(vData));
      } else {
        const cachedUser = await AsyncStorage.getItem('sahay_user');
        if (cachedUser) setVictim(JSON.parse(cachedUser));
      }

      if (alertsRes?.data?.data) {
        setAlerts(alertsRes.data.data);
        if (alertsRes.data.summary) {
          setSummary(alertsRes.data.summary);
        }
      }
      fetchAndSyncLocation();
    } catch (err) {
      console.error('Failed to load victim dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchAndSyncLocation]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    fetchAndSyncLocation();
  };

  // Prominent "CREATE NEW EMERGENCY ALERT" Action
  const handleCreateEmergencyAlert = async () => {
    if (triggeringAlert) return;
    setTriggeringAlert(true);
    try {
      let locData: any = {};
      try {
        const lStr = await AsyncStorage.getItem('sahay_location');
        if (lStr) locData = JSON.parse(lStr);
      } catch (_e) {}

      const res = await api.post('/api/cases', {
        channel: 'emergency_buzzer',
        language: victim?.language || language || 'English',
        incident_type: 'Immediate Danger',
        is_emergency: true,
        priority: 'EMERGENCY',
        district: locData.district || victim?.district,
        state: locData.state || victim?.state,
        address: locData.address || victim?.address,
        latitude: locData.latitude || victim?.latitude,
        longitude: locData.longitude || victim?.longitude,
      });

      const newCase = res.data?.data?.case || res.data?.case || res.data;
      if (newCase) {
        // Save as current active case in AsyncStorage
        await AsyncStorage.setItem('sahay_case', JSON.stringify(newCase));
        await AsyncStorage.setItem('sahay_safety_answer', 'yes');
        await AsyncStorage.setItem('sahay_new_alert_banner', 'true');

        // Immediately route to the live tracking screen with the specific case ID
        router.push({
          pathname: '/victim/tracking',
          params: { caseId: String(newCase.id) },
        });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Unable to create emergency alert. Please call 112 directly.';
      Alert.alert('Emergency Alert Error', msg);
    } finally {
      setTriggeringAlert(false);
    }
  };

  // View specific alert from history
  const handleViewAlert = async (alertItem: any) => {
    try {
      await AsyncStorage.setItem('sahay_case', JSON.stringify(alertItem));
    } catch (_e) {}
    router.push({
      pathname: '/victim/tracking',
      params: { caseId: String(alertItem.id) },
    });
  };

  // Sign out cleanly
  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'sahay_token',
        'sahay_user',
        'sahay_case',
        'sahay_safety_answer',
        'sahay_new_alert_banner',
      ]);
    } catch (_e) {}
    router.replace('/auth/login');
  };

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    victim?.name || 'Citizen'
  )}&background=0f3a6d&color=fff&size=128`;
  const avatarUrl = victim?.profile_picture || defaultAvatar;

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.emblemCircle}>
            <RiShieldCheckFill size={22} color="#38bdf8" />
          </View>
          <View>
            <Text style={styles.appTitle}>SAHAY-AI</Text>
            <Text style={styles.appSubtitle}>Citizen Safety Portal · Helpline 14566</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.langBadge}
          onPress={() => router.push('/victim/language')}
          activeOpacity={0.8}
        >
          <RiTranslate2 size={14} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.langBadgeText}>{victim?.language || language || 'English'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1a4d8f']} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1a4d8f" />
            <Text style={styles.loadingText}>Loading your profile and emergency alerts...</Text>
          </View>
        ) : (
          <>
            {/* Citizen Profile Card */}
            <View style={styles.profileCard}>
              <View style={styles.profileHeader}>
                <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} resizeMode="cover" />
                <View style={styles.profileInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.victimName}>{victim?.name || 'Registered Citizen'}</Text>
                    <View style={styles.victimIdBadge}>
                      <Text style={styles.victimIdText}>
                        VIC-{victim?.id || victim?.user_id || 'PROV'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.contactRow}>
                    <View style={styles.contactItem}>
                      <RiPhoneLine size={12} color="#64748b" style={{ marginRight: 3 }} />
                      <Text style={styles.profileContactText}>{victim?.phone || 'No phone'}</Text>
                    </View>
                    <Text style={styles.contactDot}>·</Text>
                    <View style={styles.contactItem}>
                      <RiMailLine size={12} color="#64748b" style={{ marginRight: 3 }} />
                      <Text style={styles.profileContactText} numberOfLines={1}>
                        {victim?.email || 'No email'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Comprehensive Current Location Section */}
              <View style={styles.locationContainer}>
                <View style={styles.locationTopRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <RiMapPin2Line size={14} color="#dc2626" />
                    <Text style={styles.locationTitle}>Current Location</Text>
                  </View>
                  <View style={styles.liveGpsIndicator}>
                    <View style={[styles.liveGpsDot, { backgroundColor: locFetching ? '#eab308' : '#16a34a' }]} />
                    <Text style={styles.liveGpsText}>
                      {locFetching ? 'Acquiring GPS...' : 'GPS Synchronized'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.locationAddressText} numberOfLines={2}>
                  {victim?.address || 'Locating current device position...'}
                </Text>
                {(victim?.district || victim?.state) && (
                  <View style={styles.locationCoordsRow}>
                    <Text style={styles.locationDistrictState}>
                      {[victim?.district, victim?.state].filter(Boolean).join(', ')}
                    </Text>
                    {victim?.latitude && victim?.longitude && (
                      <Text style={styles.locationCoords}>
                        ({Number(victim.latitude).toFixed(4)}°, {Number(victim.longitude).toFixed(4)}°)
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* PROMINENT EMERGENCY BUTTON SECTION */}
            <View style={styles.emergencyCtaWrap}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }], width: '100%' }}>
                <TouchableOpacity
                  style={[styles.emergencyBtn, triggeringAlert && styles.btnDisabled]}
                  onPress={handleCreateEmergencyAlert}
                  activeOpacity={0.85}
                  disabled={triggeringAlert}
                >
                  <View style={styles.emergencyBtnInner}>
                    <View style={styles.emergencyIconBubble}>
                      <RiAlarmWarningFill size={28} color="#ffffff" />
                    </View>
                    <View style={styles.emergencyTextWrap}>
                      <Text style={styles.emergencyBtnTitle}>CREATE NEW EMERGENCY ALERT</Text>
                      <Text style={styles.emergencyBtnSub}>
                        Tap to broadcast live SOS location and alert emergency operators immediately
                      </Text>
                    </View>
                  </View>
                  {triggeringAlert && (
                    <ActivityIndicator size="small" color="#fff" style={{ marginTop: 8 }} />
                  )}
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity
                style={styles.guidedReportLink}
                onPress={() => router.push('/victim/safety')}
                activeOpacity={0.7}
              >
                <RiFileShieldLine size={14} color="#1a4d8f" style={{ marginRight: 4 }} />
                <Text style={styles.guidedReportText}>
                  Need a guided assessment instead? Tap for Standard Safety Report
                </Text>
                <RiArrowRightLine size={13} color="#1a4d8f" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>

            {/* Summary Statistics Bar */}
            <View style={styles.statsRow}>
              <View style={[styles.statBox, { borderLeftColor: '#1a4d8f' }]}>
                <View style={styles.statBoxHeader}>
                  <Text style={[styles.statNum, { color: '#1a4d8f' }]}>{summary.total}</Text>
                  <RiFileList3Line size={16} color="#1a4d8f" />
                </View>
                <Text style={styles.statLabel}>Total Alerts</Text>
              </View>
              <View style={[styles.statBox, { borderLeftColor: '#dc2626' }]}>
                <View style={styles.statBoxHeader}>
                  <Text style={[styles.statNum, { color: '#dc2626' }]}>{summary.active}</Text>
                  <RiAlarmWarningLine size={16} color="#dc2626" />
                </View>
                <Text style={styles.statLabel}>Active Alerts</Text>
              </View>
              <View style={[styles.statBox, { borderLeftColor: '#16a34a' }]}>
                <View style={styles.statBoxHeader}>
                  <Text style={[styles.statNum, { color: '#16a34a' }]}>{summary.resolved}</Text>
                  <RiCheckboxCircleLine size={16} color="#16a34a" />
                </View>
                <Text style={styles.statLabel}>Resolved Cases</Text>
              </View>
            </View>

            {/* Active Alert Banner (If any active alert exists) */}
            {summary.latest_active && (
              <View style={styles.activeAlertCard}>
                <View style={styles.activeAlertHeader}>
                  <View style={styles.activeAlertPill}>
                    <View style={styles.pulsingDot} />
                    <RiAlarmWarningFill size={13} color="#dc2626" style={{ marginRight: 2 }} />
                    <Text style={styles.activeAlertPillText}>ACTIVE EMERGENCY INCIDENT</Text>
                  </View>
                  <Text style={styles.activeAlertCaseNum}>
                    {summary.latest_active.case_number}
                  </Text>
                </View>
                <Text style={styles.activeAlertDesc}>
                  {summary.latest_active.description ||
                    'Immediate danger reported · Operator response team is actively monitoring this case.'}
                </Text>
                <View style={styles.activeAlertFooter}>
                  <View style={styles.activeAlertTimeWrap}>
                    <RiTimeLine size={13} color="#9f1239" style={{ marginRight: 4 }} />
                    <Text style={styles.activeAlertTime}>
                      {formatISTDateTime(summary.latest_active.created_at)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.openActiveAlertBtn}
                    onPress={() => handleViewAlert(summary.latest_active)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.openActiveAlertBtnText}>Open Live Tracker & Chat</Text>
                    <RiArrowRightLine size={13} color="#ffffff" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Alert History Section */}
            <View style={styles.historySection}>
              <View style={styles.historyHeaderRow}>
                <View style={styles.historyTitleWrap}>
                  <RiFileList3Line size={18} color="#0f172a" style={{ marginRight: 6 }} />
                  <Text style={styles.historyTitle}>My Emergency Alerts History</Text>
                </View>
                <TouchableOpacity onPress={onRefresh} activeOpacity={0.7} style={styles.historyRefreshBtn}>
                  <RiRefreshLine size={13} color="#1a4d8f" style={{ marginRight: 3 }} />
                  <Text style={styles.historyRefreshLink}>Refresh</Text>
                </TouchableOpacity>
              </View>

              {alerts.length === 0 ? (
                <View style={styles.emptyHistoryCard}>
                  <RiShieldCheckLine size={36} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>No Emergency Alerts Yet</Text>
                  <Text style={styles.emptySub}>
                    Any emergency alerts or safety reports you create will be securely stored here.
                  </Text>
                </View>
              ) : (
                alerts.map((item, index) => {
                  const badge = getStatusBadgeStyle(item.status);
                  return (
                    <View key={item.id || index} style={styles.alertCard}>
                      <View style={styles.alertCardTop}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.alertIdRow}>
                            <Text style={styles.alertCaseNumber}>{item.case_number}</Text>
                            <Text style={styles.alertIdSub}>Alert #{item.id}</Text>
                          </View>
                          <Text style={styles.alertIncidentType}>
                            {item.incident_type || 'Emergency Buzzer Alert'}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: badge.bg, borderColor: badge.border },
                          ]}
                        >
                          {badge.isEmergency && (
                            <RiAlarmWarningFill size={11} color={badge.text} style={{ marginRight: 3 }} />
                          )}
                          <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                            {badge.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.alertCardDetails}>
                        <View style={styles.alertDetailLineRow}>
                          <RiTimeLine size={12} color="#64748b" style={{ marginRight: 4 }} />
                          <Text style={styles.alertDetailLine}>
                            <Text style={{ fontWeight: '600' }}>Created:</Text>{' '}
                            {formatISTDateTime(item.created_at)}
                          </Text>
                        </View>
                        {(item.district || item.state) && (
                          <View style={styles.alertDetailLineRow}>
                            <RiMapPin2Line size={12} color="#64748b" style={{ marginRight: 4 }} />
                            <Text style={styles.alertDetailLine}>
                              <Text style={{ fontWeight: '600' }}>Location:</Text>{' '}
                              {[item.district, item.state].filter(Boolean).join(', ')}
                            </Text>
                          </View>
                        )}
                        {item.operator_name && (
                          <View style={styles.alertDetailLineRow}>
                            <RiShieldUserLine size={12} color="#64748b" style={{ marginRight: 4 }} />
                            <Text style={styles.alertDetailLine}>
                              <Text style={{ fontWeight: '600' }}>Assigned Operator:</Text>{' '}
                              {item.operator_name}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.alertCardActions}>
                        <TouchableOpacity
                          style={styles.viewAlertBtn}
                          onPress={() => handleViewAlert(item)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.viewAlertBtnText}>
                            View Details & Live Communication
                          </Text>
                          <RiArrowRightSLine size={15} color="#0f3a6d" style={{ marginLeft: 3 }} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Quick Emergency Numbers Footer */}
            <View style={styles.helplineFooter}>
              <View style={styles.helplineFooterHeader}>
                <RiPhoneFill size={14} color="#0f3a6d" style={{ marginRight: 5 }} />
                <Text style={styles.helplineFooterTitle}>National Emergency Helplines</Text>
              </View>
              <View style={styles.helplinePillsRow}>
                <View style={styles.helplinePill}>
                  <Text style={styles.helplinePillNum}>112</Text>
                  <Text style={styles.helplinePillName}>Police & Emergency</Text>
                </View>
                <View style={styles.helplinePill}>
                  <Text style={styles.helplinePillNum}>14566</Text>
                  <Text style={styles.helplinePillName}>NHAA Atrocities</Text>
                </View>
                <View style={styles.helplinePill}>
                  <Text style={styles.helplinePillNum}>181</Text>
                  <Text style={styles.helplinePillName}>Women Helpline</Text>
                </View>
              </View>
            </View>

            {/* Bottom Sign Out Action */}
            <View style={styles.bottomMenuSection}>
              <TouchableOpacity
                style={styles.bottomSignOutBtn}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <RiLogoutBoxRLine size={18} color="#dc2626" style={{ marginRight: 8 }} />
                <Text style={styles.bottomSignOutText}>Sign Out</Text>
              </TouchableOpacity>
              <Text style={styles.footerGovNotice}>
                Government of India · Ministry of Social Justice and Empowerment
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Persistent Bottom Navigation with Icons & Center SOS */}
      <VictimBottomNav activeTab="dashboard" caseId={summary.latest_active?.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  topHeader: {
    backgroundColor: '#0f3a6d',
    paddingTop: Platform.OS === 'web' ? 14 : 44,
    paddingBottom: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.12)' },
      default: { elevation: 4 },
    }),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emblemCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemIcon: {
    fontSize: 28,
  },
  appTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  langBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 115,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 14,
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  // Profile Card
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      web: { boxShadow: '0 2px 6px rgba(0,0,0,0.05)' },
      default: { elevation: 2 },
    }),
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e2e8f0',
    borderWidth: 2,
    borderColor: '#0f3a6d',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  victimName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  victimIdBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  victimIdText: {
    color: '#3730a3',
    fontSize: 11,
    fontWeight: '800',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactDot: {
    marginHorizontal: 6,
    color: '#94a3b8',
    fontSize: 12,
  },
  profileContactText: {
    fontSize: 12,
    color: '#64748b',
  },
  profileContact: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
  },
  locationContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  locationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  locationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  liveGpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f8fafc',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  liveGpsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveGpsText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  locationAddressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 17,
  },
  locationCoordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  locationDistrictState: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  locationCoords: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  // Bottom Menu Section
  bottomMenuSection: {
    marginTop: 20,
    marginBottom: 35,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  bottomSignOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 13,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    borderRadius: 10,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(220, 38, 38, 0.08)' },
      default: { elevation: 2 },
    }),
  },
  bottomSignOutText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#dc2626',
    letterSpacing: 0.3,
  },
  footerGovNotice: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  // Emergency CTA
  emergencyCtaWrap: {
    marginBottom: 16,
    alignItems: 'center',
  },
  emergencyBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: '#b91c1c',
    ...Platform.select({
      web: { boxShadow: '0 6px 18px rgba(220, 38, 38, 0.35)' },
      default: { elevation: 6 },
    }),
  },
  emergencyBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  emergencyIconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyIconText: {
    fontSize: 26,
  },
  emergencyTextWrap: {
    flex: 1,
  },
  emergencyBtnTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  emergencyBtnSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  guidedReportLink: {
    marginTop: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidedReportText: {
    color: '#1a4d8f',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
      default: { elevation: 1 },
    }),
  },
  statBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statNum: {
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  // Active Alert Card
  activeAlertCard: {
    backgroundColor: '#fff1f2',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
  },
  activeAlertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 6,
  },
  activeAlertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffe4e6',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
  },
  activeAlertPillText: {
    color: '#991b1b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeAlertCaseNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#881337',
  },
  activeAlertDesc: {
    fontSize: 13,
    color: '#4c0519',
    lineHeight: 18,
    marginBottom: 10,
  },
  activeAlertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeAlertTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeAlertTime: {
    fontSize: 11,
    color: '#9f1239',
  },
  openActiveAlertBtn: {
    backgroundColor: '#b91c1c',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  openActiveAlertBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  // History Section
  historySection: {
    marginBottom: 20,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  historyRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyRefreshLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a4d8f',
  },
  emptyHistoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyIcon: {
    fontSize: 34,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  emptySub: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  alertCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
      default: { elevation: 1 },
    }),
  },
  alertCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  alertIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  alertCaseNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f3a6d',
  },
  alertIdSub: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  alertIncidentType: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  alertCardDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    gap: 4,
  },
  alertDetailLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertDetailLine: {
    fontSize: 12,
    color: '#475569',
  },
  alertCardActions: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  viewAlertBtn: {
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAlertBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f3a6d',
  },
  // Helplines Footer
  helplineFooter: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  helplineFooterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  helplineFooterTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
  },
  helplinePillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  helplinePill: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  helplinePillNum: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f3a6d',
  },
  helplinePillName: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 2,
  },
});
