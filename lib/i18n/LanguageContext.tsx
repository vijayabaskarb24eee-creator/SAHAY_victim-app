import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SUPPORTED_LANGS,
  Language,
  Translations,
  translationsMap,
  translate as translateRaw,
} from './translations';
import api from '../api';

const STORAGE_KEY = 'sahay_language';

// Synchronously detect initial language if running in browser
let initialSyncLang: Language = 'English';
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && (SUPPORTED_LANGS as readonly string[]).includes(stored)) {
      initialSyncLang = stored as Language;
    }
  } catch (_e) {}
}

let _currentLanguage: Language = initialSyncLang;

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  translations: Translations;
  SUPPORTED_LANGS: typeof SUPPORTED_LANGS;
  ready: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: initialSyncLang,
  setLanguage: async () => {},
  t: (key) => key,
  translations: translationsMap[initialSyncLang] || translationsMap.English,
  SUPPORTED_LANGS,
  ready: true,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(_currentLanguage);
  const [ready, setReady] = useState(true);

  // Re-check async storage on mount (especially for native mobile)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && (SUPPORTED_LANGS as readonly string[]).includes(saved)) {
          _currentLanguage = saved as Language;
          if (mounted) setLanguageState(saved as Language);
        }
      } catch (_e) {}
      if (mounted) setReady(true);
    })();
    return () => { mounted = false; };
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    if (!lang) return;
    _currentLanguage = lang;
    setLanguageState(lang);

    // Save synchronously in localStorage for web
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, lang);
      } catch (_e) {}
    }

    // Save in AsyncStorage for mobile/cross-platform
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    } catch (_e) {}

    // Persist to backend if user is authenticated
    try {
      const token = await AsyncStorage.getItem('sahay_token');
      if (token) {
        await api.patch('/api/victims/language', { language: lang });
      }
    } catch (_e) {}
  }, []);

  const t = useCallback(
    (key: string, replacements?: Record<string, string | number>) =>
      translateRaw(language, key, replacements),
    [language]
  );

  const translations: Translations = useMemo(
    () => translationsMap[language] || translationsMap.English,
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      translations,
      SUPPORTED_LANGS,
      ready,
    }),
    [language, setLanguage, t, translations, ready]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  return useContext(LanguageContext);
}

export function getCurrentLanguage(): Language {
  return _currentLanguage;
}
