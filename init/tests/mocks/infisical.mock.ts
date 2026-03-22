import { mock } from 'bun:test';
import { VCR } from './VCR';

type SecretEntry = { key: string; value: string; environment?: string; path?: string };

export const createMockInfisical = () => {
  const secretStore = new Map<string, string>();
  const getSecretVcr = new VCR<string>();

  const mocks = {
    getSecret: mock((key: string, _opts?: { projectId?: string; environment?: string; path?: string }) => {
      // VCR first, then store fallback
      if (!getSecretVcr.isEmpty()) return getSecretVcr.require();
      return secretStore.get(key) ?? '';
    }),
    getSecretAsync: mock(async (key: string, opts?: { projectId?: string; environment?: string; path?: string }) => {
      if (!getSecretVcr.isEmpty()) return getSecretVcr.require();
      // Composite key for environment-specific lookups
      const compositeKey = opts?.environment ? `${opts.environment}:${opts.path ?? '/'}:${key}` : key;
      return secretStore.get(compositeKey) ?? secretStore.get(key) ?? '';
    }),
    setSecret: mock((_projectId: string, _env: string, key: string, value: string) => {
      secretStore.set(key, value);
    }),
    setSecretAsync: mock(async (_projectId: string, _env: string, key: string, value: string) => {
      secretStore.set(key, value);
    }),
    setupInfisical: mock(async () => ({
      projectId: 'test-project-id',
      organizationId: 'test-org-id',
    })),
  };

  return {
    mocks,
    vcr: { getSecret: getSecretVcr },
    secretStore,
    /** Pre-seed secrets (e.g., connection strings for resume scenarios) */
    seed: (entries: SecretEntry[]) => {
      for (const entry of entries) {
        const compositeKey = entry.environment ? `${entry.environment}:${entry.path ?? '/'}:${entry.key}` : entry.key;
        secretStore.set(compositeKey, entry.value);
        secretStore.set(entry.key, entry.value);
      }
    },
    install: () => {
      mock.module('../../tasks/infisicalSetup', () => mocks);
      // Also mock the api/infisical module for direct API calls
      mock.module('../../api/infisical', () => ({
        createFolder: mock(async () => {}),
        createSecretImport: mock(async () => {}),
        getOrganization: mock(async () => ({ id: 'org-id', name: 'test-org' })),
        getProject: mock(async () => ({ id: 'proj-id', name: 'template' })),
        updateEnvironment: mock(async () => {}),
        updateProjectSlug: mock(async () => {}),
        upsertProject: mock(async () => ({ id: 'test-project-id', name: 'template' })),
      }));
    },
    clearAll: () => {
      for (const fn of Object.values(mocks)) fn.mockClear();
      getSecretVcr.clear();
      secretStore.clear();
    },
  };
};

export type MockInfisical = ReturnType<typeof createMockInfisical>;
