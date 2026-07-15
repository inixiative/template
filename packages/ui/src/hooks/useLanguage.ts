/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import { useEffect } from 'react';

export const useLanguage = () => {
  useEffect(() => {
    const lang = navigator.language.split('-')[0] || 'en';
    document.documentElement.lang = lang;
  }, []);
};
