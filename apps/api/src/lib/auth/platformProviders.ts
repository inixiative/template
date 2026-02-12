export interface PlatformProvider {
  type: 'oauth' | 'saml';
  provider: string;
  name: string;
  enabled: boolean;
}

export function getPlatformProviders(): PlatformProvider[] {
  const providers: PlatformProvider[] = [];

  if (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET
  ) {
    providers.push({
      type: 'oauth',
      provider: 'google',
      name: 'Google',
      enabled: true,
    });
  }

  if (
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET
  ) {
    providers.push({
      type: 'oauth',
      provider: 'github',
      name: 'GitHub',
      enabled: true,
    });
  }

  return providers;
}
