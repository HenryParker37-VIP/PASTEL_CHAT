import React, { createContext, useContext, useState } from 'react';
import en from './en';
import vi from './vi';

const translations = { en, vi };

export const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
];

const LangContext = createContext(null);

export const LangProvider = ({ children }) => {
  const [lang, setLangState] = useState(localStorage.getItem('lang') || 'vi');

  const setLang = (code) => {
    setLangState(code);
    localStorage.setItem('lang', code);
  };

  // t(key) — returns string or calls function with args
  const t = (key, ...args) => {
    const val = translations[lang]?.[key] ?? translations.en[key] ?? key;
    return typeof val === 'function' ? val(...args) : val;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t, LANGUAGES }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => useContext(LangContext);
