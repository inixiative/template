/**
 * PACKAGE INDEX FILE - Cross-package exports use relative imports.
 * All other files in this package should use absolute #/ imports.
 */

export * from './components/Avatar';
export * from './components/auth/AuthDivider';
// Auth components
export * from './components/auth/LoginForm';
export * from './components/auth/SignupForm';
export * from './components/auth/SocialAuthButton';
// Base components
export * from './components/Breadcrumbs';
export * from './components/Button';
export * from './components/Card';
export * from './components/ComingSoon';
export * from './components/DropdownMenu';
export * from './components/EmptyState';
export * from './components/ErrorBoundary';
export * from './components/Input';
export * from './components/Label';
export * from './components/layout/AppShell';
// Layout components
export * from './components/layout/ContextSelector';
export * from './components/layout/DetailPanel';
export * from './components/layout/Header';
export * from './components/layout/MasterDetailLayout';
export * from './components/layout/Modal';
export * from './components/layout/ResponsiveDrawer';
export {
  Sidebar,
  type NavConfig,
  type NavContext,
  type NavItem,
} from './components/layout/Sidebar';
export * from './components/layout/UserMenu';
export * from './components/NotFound';
export * from './components/RootNotFound';
export * from './components/ShareButton';
export * from './components/Table';
export * from './components/ThemeToggle';
export * from './components/Unauthorized';

// Hooks
export * from './hooks/useDarkMode';
export * from './hooks/useLanguage';
export * from './hooks/useMediaQuery';
export * from './hooks/useSpaceTheme';
export * from './hooks/useThemePersistence';

// Types
export * from './types';

// Utils
export * from './lib/utils';
