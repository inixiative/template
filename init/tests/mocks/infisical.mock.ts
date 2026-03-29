import { mock } from 'bun:test';

type SecretEntry = { key: string; value: string; environment?: string; path?: string };

const getEnvSecret = (key: string): string => process.env[key] ?? '';

export const createMockInfisical = () => {
  const secretStore = new Map<string, string>();

  const mocks = {
    getSecret: mock((key: string, _opts?: { projectId?: string; environment?: string; path?: string }) => {
      return secretStore.get(key) ?? getEnvSecret(key);
    }),
    getSecretAsync: mock(async (key: string, opts?: { projectId?: string; environment?: string; path?: string }) => {
      const compositeKey = opts?.environment ? `${opts.environment}:${opts.path ?? '/'}:${key}` : key;
      return secretStore.get(compositeKey) ?? secretStore.get(key) ?? getEnvSecret(key);
    }),
    setSecret: mock((_projectId: string, _env: string, key: string, value: string) => {
      secretStore.set(key, value);
    }),
    setSecretAsync: mock(async (_projectId: string, _env: string, key: string, value: string, path?: string) => {
      const compositeKey = path ? `${_env}:${path}:${key}` : key;
      secretStore.set(compositeKey, value);
      secretStore.set(key, value);
    }),
    setupInfisical: mock(async () => ({
      projectId: 'test-project-id',
      organizationId: 'test-org-id',
    })),
  };

  return {
    mocks,
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
    },
    clearAll: () => {
      for (const fn of Object.values(mocks)) fn.mockClear();
      secretStore.clear();
    },
  };
};

export type MockInfisical = ReturnType<typeof createMockInfisical>;
