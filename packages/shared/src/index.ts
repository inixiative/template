/**
 * PACKAGE INDEX FILE - Cross-package exports use relative imports.
 * All other files in this package should use absolute #/ imports.
 */

// Re-export from submodules
export * from './utils';
export * from './lib';
export * from './hooks';
export * from './hooks/usePermission';
export * from './store';
export * from './guards/authGuard';
export * from './pages/LoginPage';
export * from './pages/SignupPage';
export * from './pages/HomePage';
export * from './pages/OrganizationsPage';
export * from './pages/OrganizationUsersPage';
export * from './components/SettingsLayout';
export * from './components/CreateTokenModal';
export * from './components/InviteUserModal';

// Re-export API client
export { client } from './apiClient';

// Auth utilities
export { initializeAuth } from './auth/initializeAuth';
export { logout } from './auth/logout';

// Shared components
export { CreateOrganizationModal } from './components/CreateOrganizationModal';
export { UserProfileTab } from './components/UserProfileTab';
export { UserTokensTab } from './components/UserTokensTab';
export { UserWebhooksTab } from './components/UserWebhooksTab';
export { ErrorBoundary } from './components/ErrorBoundary';
