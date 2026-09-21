import { describe, expect, it } from 'bun:test';
import { log } from '@template/shared/logger/logger';
import { addLogBroadcast, logScope } from '@template/shared/logger/scope';

// Capture composed log output via a broadcast target bound to the current scope.
const capture = (fn: () => void): string[] => {
  const msgs: string[] = [];
  const previous = log.level;
  log.level = 'info';
  logScope('root', () => {
    addLogBroadcast((_level, msg) => msgs.push(msg));
    fn();
  });
  log.level = previous;
  return msgs;
};

describe('log.child', () => {
  it('returns a usable logger instead of throwing', () => {
    const child = log.child({ class: 'baileys' });
    expect(typeof child.info).toBe('function');
    expect(typeof child.child).toBe('function');
  });

  it('tags child logs with the scope derived from bindings', () => {
    const msgs = capture(() => log.child({ class: 'baileys' }).info('hello'));
    expect(msgs.some((m) => m.includes('[baileys]') && m.includes('hello'))).toBe(true);
  });

  it('recurses — a child of a child accumulates scopes', () => {
    const msgs = capture(() => log.child({ class: 'a' }).child({ class: 'b' }).warn('deep'));
    expect(msgs.some((m) => m.includes('[a:b]') && m.includes('deep'))).toBe(true);
  });

  it('falls back to the first binding value, then "child"', () => {
    const msgs = capture(() => {
      log.child({ stream: 'in' }).info('streamed');
      log.child().info('bare');
    });
    expect(msgs.some((m) => m.includes('[in]') && m.includes('streamed'))).toBe(true);
    expect(msgs.some((m) => m.includes('[child]') && m.includes('bare'))).toBe(true);
  });
});

it('native Pino respects level and redacts child bindings as well as arguments', () => {
  const modulePath = `${import.meta.dir}/pinoAdapter.ts`;
  const result = Bun.spawnSync({
    cmd: [
      'bun',
      '-e',
      `import { pinoLogger } from ${JSON.stringify(modulePath)};
      const child = pinoLogger.child({token: 'private-child-token', email: 'private@example.test'});
      child.trace('hidden-trace');
      child.error({password: 'private-password'}, 'Visible error');`,
    ],
    env: { ...process.env, LOG_LEVEL: 'error' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  expect(result.exitCode).toBe(0);
  const output = result.stdout.toString();
  expect(output).toContain('Visible error');
  expect(output).not.toContain('private-child-token');
  expect(output).not.toContain('private@example.test');
  expect(output).not.toContain('private-password');
  expect(output).not.toContain('hidden-trace');
});
