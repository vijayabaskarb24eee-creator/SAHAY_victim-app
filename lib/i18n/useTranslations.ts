import { useLanguage } from './LanguageContext';
export { LanguageProvider, useLanguage, getCurrentLanguage } from './LanguageContext';

export function useTranslations() {
  return useLanguage();
}

