/**
 * PACKAGE INDEX FILE - Cross-package exports use relative imports.
 * All other files in this package should use absolute #/ imports.
 */

// Base components
export * from './components/Button';
export * from './components/Input';
export * from './components/Label';
export * from './components/Card';
export * from './components/Avatar';
export * from './components/DropdownMenu';
export * from './components/Table';
export * from './components/EmptyState';
export * from './components/ErrorBoundary';

// Layout components
export * from './components/layout/ContextSelector';
export * from './components/layout/Sidebar';
export * from './components/layout/Header';
export * from './components/layout/UserMenu';
export * from './components/layout/MasterDetailLayout';
export * from './components/layout/DetailPanel';
export * from './components/layout/ResponsiveDrawer';
export * from './components/layout/Modal';
export * from './components/layout/AppShell';

// Auth components
export * from './components/auth/LoginForm';
export * from './components/auth/SignupForm';
export * from './components/auth/SocialAuthButton';
export * from './components/auth/AuthDivider';

// Hooks
export * from './hooks/useMediaQuery';

// Utils
export * from './lib/utils';