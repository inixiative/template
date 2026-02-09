/**
 * App Theme - Platform baseline colors
 * These are the default theme colors used across the platform
 * Shades: 1 (lightest) → 4 (darkest) in light mode, inverted in dark mode
 */
export type AppTheme = {
  // Brand colors with shades
  primary: string;
  primary1: string;
  primary2: string;
  primary3: string;
  primary4: string;
  primaryForeground: string;

  secondary: string;
  secondary1: string;
  secondary2: string;
  secondary3: string;
  secondary4: string;
  secondaryForeground: string;

  tertiary: string;
  tertiary1: string;
  tertiary2: string;
  tertiary3: string;
  tertiary4: string;
  tertiaryForeground: string;

  quaternary: string;
  quaternary1: string;
  quaternary2: string;
  quaternary3: string;
  quaternary4: string;
  quaternaryForeground: string;

  accent: string;
  accent1: string;
  accent2: string;
  accent3: string;
  accent4: string;
  accentForeground: string;

  // Status colors with shades
  success: string;
  success1: string;
  success2: string;
  success3: string;
  success4: string;
  successForeground: string;

  error: string;
  error1: string;
  error2: string;
  error3: string;
  error4: string;
  errorForeground: string;

  warning: string;
  warning1: string;
  warning2: string;
  warning3: string;
  warning4: string;
  warningForeground: string;

  info: string;
  info1: string;
  info2: string;
  info3: string;
  info4: string;
  infoForeground: string;

  // UI colors (no shades)
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
};
