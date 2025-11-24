'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import ko from '@/locales/ko.json';
import en from '@/locales/en.json';
import zh from '@/locales/zh.json';

type Language = 'ko' | 'en' | 'zh';

type Translations = typeof ko;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const translations: Record<Language, Translations> = {
  ko,
  en,
  zh,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ko');

  // 로컬 스토리지에서 언어 설정 로드
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && ['ko', 'en', 'zh'].includes(savedLanguage)) {
      setLanguageState(savedLanguage);
    }
  }, []);

  // 언어 변경 시 로컬 스토리지에 저장
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: translations[language],
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

