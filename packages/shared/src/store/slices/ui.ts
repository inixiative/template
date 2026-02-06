import type { StateCreator } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

export type UISlice = {
  ui: {
    theme: Theme;
    isLoading: boolean;
    isInitialized: boolean;
    setTheme: (theme: Theme) => void;
    setLoading: (loading: boolean) => void;
    hydrateSettings: (settings: { theme?: Theme }) => void;
    updateTheme: (theme: Theme) => Promise<void>;
  };
};

export const createUISlice: StateCreator<UISlice> = (set) => ({
  ui: {
    theme: 'system',
    isLoading: false,
    isInitialized: false,

    setTheme: (theme) =>
      set((state) => ({
        ui: { ...state.ui, theme },
      })),

    setLoading: (loading) =>
      set((state) => ({
        ui: { ...state.ui, isLoading: loading },
      })),

    hydrateSettings: (settings) =>
      set((state) => ({
        ui: {
          ...state.ui,
          theme: settings.theme ?? state.ui.theme,
          isInitialized: true,
        },
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
