import type { StateCreator } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

export type UISlice = {
  ui: {
    theme: Theme;
    isLoading: boolean;
    appName: string;
    shortName: string;
    description: string;
    setTheme: (theme: Theme) => void;
    setLoading: (loading: boolean) => void;
    updateTheme: (theme: Theme) => Promise<void>;
  };
};

export const createUISlice: StateCreator<UISlice> = (set) => ({
  ui: {
    theme: 'system',
    isLoading: false,
    appName: import.meta.env.VITE_APP_NAME || 'Template',
    shortName: import.meta.env.VITE_APP_SHORT_NAME || 'Template',
    description: import.meta.env.VITE_APP_DESCRIPTION || 'TanStack Router + React Aria + Tailwind',

    setTheme: (theme) =>
      set((state) => ({
        ui: { ...state.ui, theme },
      })),

    setLoading: (loading) =>
      set((state) => ({
        ui: { ...state.ui, isLoading: loading },
      })),

    updateTheme: async (theme) => {
      // TODO: Call API to update user settings
      // await fetch('/api/users/me/settings', { method: 'PATCH', body: { theme } })
      set((state) => ({
        ui: { ...state.ui, theme },
      }));
    },
  },
});
