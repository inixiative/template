import type { CicdConfig } from './config';

export const makeCicdConfig = (): CicdConfig => ({
  version: 1,
  production: { branch: 'main' },
  staging: { enabled: false, branch: 'staging' },
  pullRequests: {
    deploy: 'manual',
    drafts: { deploy: 'manual' },
    requiredApprovals: 1,
    allowBotApprovals: false,
    maxActive: 2,
  },
  database: { strategy: 'schema-push', seedOnRelease: true },
});
