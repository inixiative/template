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
