/**
 * @atlas
 * @kind store
 * @partOf primitive:ui
 * @uses none
 */
import type { AppStore } from '@template/ui/store/types';
import type { UISlice } from '@template/ui/store/types/ui';
import type { StateCreator } from 'zustand';

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
  ui: {
    theme: 'system',
    projectName: import.meta.env.VITE_PROJECT_NAME || 'Template',
    appName: import.meta.env.VITE_APP_NAME || 'App',
    shortName: import.meta.env.VITE_APP_SHORT_NAME || 'Template',
    logo: import.meta.env.VITE_APP_LOGO_URL || '',
    description: import.meta.env.VITE_APP_DESCRIPTION || 'TanStack Router + React Aria + Tailwind',

    setTheme: (theme) =>
      set((state) => ({
        ui: { ...state.ui, theme },
      })),
  },
});
