import type { CicdConfig } from './scripts/cicd/config';

export const cicdConfig = {
  version: 1,
  production: {
    branch: 'main',
    deploy: 'auto',
  },
  staging: {
    enabled: false,
    branch: 'staging',
  },
  pullRequests: {
    deploy: 'manual',
    drafts: {
      deploy: 'manual',
    },
    requiredApprovals: 1,
    allowBotApprovals: false,
    cleanupOnClose: true,
    maxActive: 2,
  },
  checks: {
    pre: true,
    post: true,
  },
  database: {
    strategy: 'schema-push',
    seedOnRelease: false,
  },
} satisfies CicdConfig;
