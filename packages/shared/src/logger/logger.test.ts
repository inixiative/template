import { describe, expect, it } from 'bun:test';
import { log } from '@template/shared/logger/logger';
import { addLogBroadcast, logScope } from '@template/shared/logger/scope';

// Capture composed log output via a broadcast target bound to the current scope.
const capture = (fn: () => void): string[] => {
  const msgs: string[] = [];
  logScope('root', () => {
    addLogBroadcast((_level, msg) => msgs.push(msg));
    fn();
  });
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
