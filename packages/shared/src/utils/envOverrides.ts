/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */

// Tests must never mutate process.env: an unrestored assignment leaks across bun's
// single-process suite and breaks unrelated tests nondeterministically (enforced by the
// no-test-env-mutation CI rule). Overrides registered here win over the real value —
// reads resolve through the proxy installed at test bootstrap — and the suite-level
// afterEach backstop clears them after every test.
const envOverrides: Record<string, string | undefined> = {};

export const setEnvOverride = (key: string, value: string | undefined): void => {
  envOverrides[key] = value;
};

export const resetEnvOverrides = (): void => {
  for (const key of Object.keys(envOverrides)) delete envOverrides[key];
};

export const withEnv = async <T>(
  overrides: Record<string, string | undefined>,
  fn: () => T | Promise<T>,
): Promise<T> => {
  const prior = Object.keys(overrides).map((key) => [key, key in envOverrides, envOverrides[key]] as const);
  for (const [key, value] of Object.entries(overrides)) envOverrides[key] = value;
  try {
    return await fn();
  } finally {
    for (const [key, had, value] of prior) {
      if (had) envOverrides[key] = value;
      else delete envOverrides[key];
    }
  }
};

export const wrapEnvWithOverrides = <T extends object>(target: T): T =>
  new Proxy(target, {
    get(t, prop, receiver) {
      if (typeof prop === 'string' && prop in envOverrides) return envOverrides[prop];
      return Reflect.get(t, prop, receiver);
    },
  });

let installed = false;

export const installEnvOverrideProxy = (): void => {
  if (installed) return;
  installed = true;
  process.env = wrapEnvWithOverrides(process.env);
};
