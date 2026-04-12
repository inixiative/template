import { describe, expect, it } from 'bun:test';
import { makeBroadcastRegistry } from '@template/shared/adapter';

describe('makeBroadcastRegistry', () => {
  it('registers and retrieves an adapter by name', () => {
    const registry = makeBroadcastRegistry<{ value: number }>();
    registry.register('a', { value: 1 });

    expect(registry.get('a')).toEqual({ value: 1 });
  });

  it('throws on get for unknown adapter', () => {
    const registry = makeBroadcastRegistry<{ value: number }>();
    expect(() => registry.get('missing')).toThrow('Adapter not found: missing');
  });

  it('getOrDefault returns named adapter if it exists', () => {
    const registry = makeBroadcastRegistry<{ value: number }>();
    registry.register('primary', { value: 1 });
    registry.register('fallback', { value: 2 });

    expect(registry.getOrDefault('primary', 'fallback')).toEqual({ value: 1 });
  });

  it('getOrDefault returns fallback when name is undefined', () => {
    const registry = makeBroadcastRegistry<{ value: number }>();
    registry.register('fallback', { value: 2 });

    expect(registry.getOrDefault(undefined, 'fallback')).toEqual({ value: 2 });
  });

  it('getOrDefault throws when fallback is missing', () => {
    const registry = makeBroadcastRegistry<{ value: number }>();
    expect(() => registry.getOrDefault(undefined, 'missing')).toThrow('Default adapter not found: missing');
  });

  it('broadcasts to all registered adapters', async () => {
    const results: number[] = [];
    const registry = makeBroadcastRegistry<{ process: (n: number) => Promise<void> }>();

    registry.register('a', { process: async (n) => { results.push(n * 2); } });
    registry.register('b', { process: async (n) => { results.push(n * 3); } });

    await registry.broadcast((adapter) => adapter.process(5));

    expect(results.sort()).toEqual([10, 15]);
  });

  it('broadcast uses Promise.allSettled — one failure does not block others', async () => {
    const results: string[] = [];
    const registry = makeBroadcastRegistry<{ run: () => Promise<void> }>();

    registry.register('fails', { run: async () => { throw new Error('boom'); } });
    registry.register('succeeds', { run: async () => { results.push('ok'); } });

    const settled = await registry.broadcast((a) => a.run());

    expect(results).toEqual(['ok']);
    expect(settled[0].status).toBe('rejected');
    expect(settled[1].status).toBe('fulfilled');
  });

  it('unregister removes an adapter', () => {
    const registry = makeBroadcastRegistry<{ value: number }>();
    registry.register('a', { value: 1 });
    registry.unregister('a');

    expect(registry.has('a')).toBe(false);
  });

  it('has returns true for registered, false for unregistered', () => {
    const registry = makeBroadcastRegistry<{ value: number }>();
    registry.register('a', { value: 1 });

    expect(registry.has('a')).toBe(true);
    expect(registry.has('b')).toBe(false);
  });

  it('names returns all registered adapter names', () => {
    const registry = makeBroadcastRegistry<{ value: number }>();
    registry.register('a', { value: 1 });
    registry.register('b', { value: 2 });

    expect(registry.names().sort()).toEqual(['a', 'b']);
  });
});
