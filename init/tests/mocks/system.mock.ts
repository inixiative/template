import { mock } from 'bun:test';

export const createMockSystem = () => {
  const mockExec = mock((_cmd: string, _opts: unknown, callback?: unknown) => {
    if (typeof callback === 'function') {
      callback(null, { stdout: '', stderr: '' });
    }
    return {} as ReturnType<typeof import('node:child_process').exec>;
  });

  const mockExecSync = mock((_cmd: string, _opts?: unknown) => '');

  return {
    mocks: { exec: mockExec, execSync: mockExecSync },
    install: () => {
      mock.module('node:child_process', () => ({
        exec: mockExec,
        execSync: mockExecSync,
      }));
      mock.module('node:util', () => ({
        promisify: (fn: unknown) => {
          return async (...args: unknown[]) => {
            const result = (fn as (...a: unknown[]) => unknown)(...args);
            return { stdout: result || '', stderr: '' };
          };
        },
      }));
    },
    clearAll: () => {
      mockExec.mockClear();
      mockExecSync.mockClear();
    },
  };
};

export type MockSystem = ReturnType<typeof createMockSystem>;
