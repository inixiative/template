/**
 * Space Theme - Tenant-specific overrides
 * Keys match CSS variable names exactly (e.g., primary → --space-primary)
 * All fields are optional - undefined values fall back to app theme
 *
 * Shades (1-4) are auto-computed via CSS color-mix() if base color is set
 * You can override individual shades if needed
 */
export type SpaceTheme = {
  // Brand colors (HSL format: "H S% L%")
  primary?: string;
  primary1?: string;
  primary2?: string;
  primary3?: string;
  primary4?: string;
  primaryForeground?: string;

  secondary?: string;
  secondary1?: string;
  secondary2?: string;
  secondary3?: string;
  secondary4?: string;
  secondaryForeground?: string;

  tertiary?: string;
  tertiary1?: string;
  tertiary2?: string;
  tertiary3?: string;
  tertiary4?: string;
  tertiaryForeground?: string;

  quaternary?: string;
  quaternary1?: string;
  quaternary2?: string;
  quaternary3?: string;
  quaternary4?: string;
  quaternaryForeground?: string;

  accent?: string;
  accent1?: string;
  accent2?: string;
  accent3?: string;
  accent4?: string;
  accentForeground?: string;

  // Assets (URLs)
  logo?: string;
  logoDark?: string;
  favicon?: string;
} | null;
