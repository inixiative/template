/**
 * @atlas
 * @kind type, store
 * @partOf primitive:ui
 * @uses none
 */
export type Theme = 'light' | 'dark' | 'system';

export type UISlice = {
  ui: {
    theme: Theme;
    projectName: string;
    appName: string;
    shortName: string;
    logo: string;
    description: string;
    setTheme: (theme: Theme) => void;
  };
};
