import { useEffect } from 'react';

export const useLanguage = () => {
  useEffect(() => {
    const lang = navigator.language.split('-')[0] || 'en';
    document.documentElement.lang = lang;
  }, []);
};
