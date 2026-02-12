import type { AuthProviderReadManyResponses, OrganizationReadAuthProviderResponses } from '@template/ui/apiClient';

type PlatformProvider = AuthProviderReadManyResponses[200]['data'][0];
type OrgProvider = OrganizationReadAuthProviderResponses[200]['data']['organization'][0];
type AuthProvider = PlatformProvider | OrgProvider;

export const redirectToOAuthProvider = (provider: AuthProvider): void => {
  try {
    const baseURL = import.meta.env.VITE_API_URL;
    const callbackURL = `${window.location.origin}/auth/callback`;

    const allowedOrigins = [window.location.origin, 'http://localhost:3000'];
    const callbackOrigin = new URL(callbackURL).origin;
    if (!allowedOrigins.includes(callbackOrigin)) {
      throw new Error('Invalid callback URL');
    }

    window.location.href = `${baseURL}/auth/${provider.provider.toLowerCase()}/signin?callbackURL=${encodeURIComponent(callbackURL)}`;
  } catch (err) {
    console.error('OAuth redirect failed:', err);
  }
};
