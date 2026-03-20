import { describe, expect, test } from 'bun:test';
import { VCR } from '../VCR';

describe('VCR', () => {
  test('plays back items in FIFO order', () => {
    const vcr = new VCR<string>();
    vcr.set(['first', 'second', 'third']);

    expect(vcr.get()).toBe('first');
    expect(vcr.get()).toBe('second');
    expect(vcr.get()).toBe('third');
    expect(vcr.get()).toBeUndefined();
  });

  test('add appends to queue', () => {
    const vcr = new VCR<number>();
    vcr.add(1);
    vcr.add(2);

    expect(vcr.size()).toBe(2);
    expect(vcr.get()).toBe(1);
    expect(vcr.get()).toBe(2);
  });

  test('next() is an alias for get()', () => {
    const vcr = new VCR<string>();
    vcr.add('value');

    expect(vcr.next()).toBe('value');
  });

  test('require() throws when queue is empty', () => {
    const vcr = new VCR<string>();

    expect(() => vcr.require()).toThrow('VCR queue exhausted');
  });

  test('require() returns item when queue has items', () => {
    const vcr = new VCR<string>();
    vcr.add('value');

    expect(vcr.require()).toBe('value');
  });

  test('addError injects errors into the queue', () => {
    const vcr = new VCR<string>();
    vcr.addError(new Error('rate limit exceeded'));
    vcr.add('success after retry');

    expect(() => vcr.get()).toThrow('rate limit exceeded');
    expect(vcr.get()).toBe('success after retry');
  });

  test('require() also throws injected errors', () => {
    const vcr = new VCR<string>();
    vcr.addError(new Error('forbidden'));

    expect(() => vcr.require()).toThrow('forbidden');
  });

  test('playOrRecord returns from queue when available', async () => {
    const vcr = new VCR<{ value: string }>();
    vcr.add({ value: 'from queue' });

    const result = await vcr.playOrRecord(
      async () => ({ value: 'from real call' }),
    );

    expect(result.value).toBe('from queue');
  });

  test('playOrRecord calls real function when queue empty', async () => {
    const vcr = new VCR<{ value: string }>();

    const result = await vcr.playOrRecord(
      async () => ({ value: 'from real call' }),
    );

    expect(result.value).toBe('from real call');
  });

  test('playOrRecord records sanitized result', async () => {
    const vcr = new VCR<{ apiKey: string; data: string }>();

    await vcr.playOrRecord(
      async () => ({ apiKey: 'sk-ant-real-secret-key-abc123', data: 'hello' }),
    );

    const recorded = vcr.getRecorded();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].apiKey).toBe('sk-ant-SANITIZED_key_abc123');
    expect(recorded[0].data).toBe('hello');
  });

  test('clear resets queue and recorded', () => {
    const vcr = new VCR<string>();
    vcr.add('item');
    vcr.clear();

    expect(vcr.isEmpty()).toBe(true);
    expect(vcr.size()).toBe(0);
    expect(vcr.getRecorded()).toHaveLength(0);
  });

  test('isEmpty and size track queue state', () => {
    const vcr = new VCR<number>();

    expect(vcr.isEmpty()).toBe(true);
    expect(vcr.size()).toBe(0);

    vcr.add(42);
    expect(vcr.isEmpty()).toBe(false);
    expect(vcr.size()).toBe(1);
  });
});
