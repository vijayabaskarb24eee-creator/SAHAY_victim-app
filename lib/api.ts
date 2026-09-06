import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Web browser (Expo Web) → localhost
// Android emulator       → 10.0.2.2  (maps to host machine)
// iOS simulator          → localhost
import Constants from 'expo-constants';

function getBackendUrl(): string {
  // 1. Explicit env var
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Web browser: auto-detect from window.location.hostname
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:5000`;
  }

  // 3. Expo Go on mobile: extract host IP from Metro connection URL
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).experienceUrl;

  if (hostUri) {
    const ip = hostUri.split(':')[0].replace(/^https?:\/\//, '');
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000`;
    }
  }

  // 4. Fallback to active machine IP
  return 'http://10.193.22.12:5000';
}

const API_URL = getBackendUrl();
const SOCKET_URL = API_URL;

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('sahay_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
export { API_URL, SOCKET_URL, getBackendUrl };
