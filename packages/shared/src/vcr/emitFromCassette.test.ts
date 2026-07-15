import { describe, expect, it } from 'bun:test';
import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emitFromCassette } from '@template/shared/vcr/emitFromCassette';

const writeCassette = (dir: string, name: string, body: unknown): string => {
  const path = join(dir, `${name}.json`);
  writeFileSync(path, JSON.stringify({ version: '1.0.0', status: 200, body }));
  return path;
};

// node's EventEmitter.listeners() is typed `Function[]`, which isn't assignable to
// emitFromCassette's stricter EmitterLike — the narrowing is sound (listeners are
// invoked with a single payload), so cast at the boundary.
const asEmitter = (ev: EventEmitter): Parameters<typeof emitFromCassette>[0] =>
  ev as unknown as Parameters<typeof emitFromCassette>[0];

describe('emitFromCassette', () => {
  it('calls sync listeners with cassette body', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cassette-'));
    const path = writeCassette(dir, 'msg', { messages: [{ id: 'a' }], type: 'notify' });
    const ev = new EventEmitter();
    const received: unknown[] = [];
    ev.on('messages.upsert', (payload) => {
      received.push(payload);
    });

    await emitFromCassette(asEmitter(ev), 'messages.upsert', path);

    expect(received).toEqual([{ messages: [{ id: 'a' }], type: 'notify' }]);
  });

  it('awaits async listeners before resolving', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cassette-'));
    const path = writeCassette(dir, 'msg', { value: 42 });
    const ev = new EventEmitter();
    let settled = false;
    ev.on('e', async () => {
      await new Promise((r) => setTimeout(r, 20));
      settled = true;
    });

    await emitFromCassette(asEmitter(ev), 'e', path);

    expect(settled).toBe(true);
  });

  it('calls multiple listeners in parallel', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cassette-'));
    const path = writeCassette(dir, 'msg', { x: 1 });
    const ev = new EventEmitter();
    const calls: number[] = [];
    ev.on('e', () => calls.push(1));
    ev.on('e', () => calls.push(2));

    await emitFromCassette(asEmitter(ev), 'e', path);

    expect(calls.sort()).toEqual([1, 2]);
  });

  it('resolves to nothing when no listeners are registered', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cassette-'));
    const path = writeCassette(dir, 'msg', { x: 1 });
    const ev = new EventEmitter();

    await expect(emitFromCassette(asEmitter(ev), 'unsubscribed', path)).resolves.toBeUndefined();
  });
});
