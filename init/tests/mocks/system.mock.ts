import { mock } from 'bun:test';
import { exec as _exec, execSync as _execSync } from 'child_process';

// Capture real function references as values — import bindings are live in ESM,
// so mock.module('child_process', ...) would replace them in-place, causing
// infinite recursion in the mockExec fallback path.
const realExec = _exec;
const realExecSync = _execSync;

type CommandMatcher = RegExp | string | ((command: string) => boolean);
type ExecResult = {
  stderr?: string;
  stdout?: string;
};

const cliPath = ['/opt/homebrew/bin', '/Users/arongreenspan/.bun/bin', process.env.PATH].filter(Boolean).join(':');

const matchesCommand = (matcher: CommandMatcher, command: string): boolean => {
  if (typeof matcher === 'function') return matcher(command);
  if (typeof matcher === 'string') return command.includes(matcher);
  return matcher.test(command);
};

const withCliPath = (options?: unknown) => {
  if (!options || typeof options !== 'object') {
    return { env: { ...process.env, PATH: cliPath } };
  }

  const typedOptions = options as { env?: Record<string, string | undefined> };
  return {
    ...typedOptions,
    env: {
      ...process.env,
      ...typedOptions.env,
      PATH: [typedOptions.env?.PATH, cliPath].filter(Boolean).join(':'),
    },
  };
};

export const createMockSystem = () => {
  const execStubs: Array<{ matcher: CommandMatcher; result: ExecResult | ((command: string) => ExecResult) }> = [];
  const execSyncStubs: Array<{ matcher: CommandMatcher; result: string | ((command: string) => string) }> = [];

  const mockExec = mock((command: string, optsOrCallback?: unknown, maybeCallback?: unknown) => {
    const callback =
      typeof optsOrCallback === 'function'
        ? optsOrCallback
        : typeof maybeCallback === 'function'
          ? maybeCallback
          : undefined;
    const options = typeof optsOrCallback === 'function' ? undefined : optsOrCallback;
    const stub = execStubs.find(({ matcher }) => matchesCommand(matcher, command));

    if (stub) {
      const result = typeof stub.result === 'function' ? stub.result(command) : stub.result;
      queueMicrotask(() => {
        callback?.(null, result.stdout ?? '', result.stderr ?? '');
      });
      return {} as ReturnType<typeof import('node:child_process').exec>;
    }

    return realExec(command, withCliPath(options) as never, callback as never);
  });

  const mockExecSync = mock((command: string, options?: unknown) => {
    const stub = execSyncStubs.find(({ matcher }) => matchesCommand(matcher, command));
    if (stub) {
      return typeof stub.result === 'function' ? stub.result(command) : stub.result;
    }
    return realExecSync(command, withCliPath(options) as never);
  });

  return {
    mocks: { exec: mockExec, execSync: mockExecSync },
    stubExec: (matcher: CommandMatcher, result: ExecResult | ((command: string) => ExecResult) = {}) => {
      execStubs.push({ matcher, result });
    },
    stubExecSync: (matcher: CommandMatcher, result: string | ((command: string) => string) = '') => {
      execSyncStubs.push({ matcher, result });
    },
    install: () => {
      mock.module('child_process', () => ({
        exec: mockExec,
        execSync: mockExecSync,
      }));
      // Also mock the execAsync wrapper — it captures `exec` at import time via
      // promisify, so mocking child_process alone doesn't intercept it.
      mock.module('../../utils/exec', () => ({
        execAsync: (command: string, options?: unknown) =>
          new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
            mockExec(command, options, (error: Error | null, stdout: string, stderr: string) => {
              if (error) reject(error);
              else resolve({ stdout, stderr });
            });
          }),
      }));
    },
    clearAll: () => {
      mockExec.mockClear();
      mockExecSync.mockClear();
      execStubs.length = 0;
      execSyncStubs.length = 0;
    },
  };
};

export type MockSystem = ReturnType<typeof createMockSystem>;
