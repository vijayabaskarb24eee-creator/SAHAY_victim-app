import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import {
  RiHome4Line,
  RiHome4Fill,
  RiAlarmWarningFill,
  RiCompass3Line,
  RiCompass3Fill,
  RiShieldCheckLine,
  RiShieldCheckFill,
  RiTranslate2,
} from 'react-icons/ri';

interface VictimBottomNavProps {
  activeTab?: 'dashboard' | 'sos' | 'tracking' | 'safety' | 'language';
  caseId?: number | string;
}

export default function VictimBottomNav({ activeTab = 'dashboard', caseId }: VictimBottomNavProps) {
  const router = useRouter();

  const handleNav = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        router.push('/victim/dashboard');
        break;
      case 'sos':
        router.push('/victim/emergency-buzzer');
        break;
      case 'tracking':
        if (caseId) {
          router.push(`/victim/tracking?caseId=${caseId}`);
        } else {
          router.push('/victim/tracking');
        }
        break;
      case 'safety':
        router.push('/victim/safety');
        break;
      case 'language':
        router.push('/victim/language');
        break;
      default:
        router.push('/victim/dashboard');
    }
  };

  return (
    <View style={styles.bottomNavContainer}>
      {/* 1. Dashboard Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => handleNav('dashboard')}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrapper, activeTab === 'dashboard' && styles.activeIconWrapper]}>
          {activeTab === 'dashboard' ? (
            <RiHome4Fill size={22} color="#1a4d8f" />
          ) : (
            <RiHome4Line size={22} color="#64748b" />
          )}
        </View>
        <Text style={[styles.navLabel, activeTab === 'dashboard' && styles.activeNavLabel]}>
          Home
        </Text>
      </TouchableOpacity>

      {/* 2. Safety Assessment Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => handleNav('safety')}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrapper, activeTab === 'safety' && styles.activeIconWrapper]}>
          {activeTab === 'safety' ? (
            <RiShieldCheckFill size={22} color="#1a4d8f" />
          ) : (
            <RiShieldCheckLine size={22} color="#64748b" />
          )}
        </View>
        <Text style={[styles.navLabel, activeTab === 'safety' && styles.activeNavLabel]}>
          Safety
        </Text>
      </TouchableOpacity>

      {/* 3. CENTER SOS EMERGENCY BUTTON (Prominent Pulsing) */}
      <TouchableOpacity
        style={styles.centerSosBtn}
        onPress={() => handleNav('sos')}
        activeOpacity={0.85}
      >
        <View style={styles.centerSosInner}>
          <RiAlarmWarningFill size={26} color="#ffffff" />
          <Text style={styles.centerSosText}>SOS</Text>
        </View>
      </TouchableOpacity>

      {/* 4. Live Tracking & Chat Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => handleNav('tracking')}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrapper, activeTab === 'tracking' && styles.activeIconWrapper]}>
          {activeTab === 'tracking' ? (
            <RiCompass3Fill size={22} color="#1a4d8f" />
          ) : (
            <RiCompass3Line size={22} color="#64748b" />
          )}
        </View>
        <Text style={[styles.navLabel, activeTab === 'tracking' && styles.activeNavLabel]}>
          Track
        </Text>
      </TouchableOpacity>

      {/* 5. Language Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => handleNav('language')}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrapper, activeTab === 'language' && styles.activeIconWrapper]}>
          <RiTranslate2 size={21} color={activeTab === 'language' ? '#1a4d8f' : '#64748b'} />
        </View>
        <Text style={[styles.navLabel, activeTab === 'language' && styles.activeNavLabel]}>
          Language
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavContainer: {
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed' as any,
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          maxWidth: 445,
          marginHorizontal: 'auto',
          zIndex: 9999,
        } as any)
      : {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
        }),
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    boxShadow: '0 -3px 12px rgba(0,0,0,0.07)',
    elevation: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    minWidth: 54,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  activeIconWrapper: {
    backgroundColor: '#e8f0fb',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  activeNavLabel: {
    color: '#1a4d8f',
    fontWeight: '700',
  },
  centerSosBtn: {
    top: -14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
  },
  centerSosInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  centerSosText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: -2,
  },
});
