/**
 * VCR (Video Cassette Recorder) - Queue-based response manager for init tests
 *
 * Stores service-shaped responses that get popped off in FIFO order.
 * Load from JSON fixtures or set inline for focused tests.
 *
 * Supports error injection: items can be values or Error instances.
 * When an Error is popped, it's thrown instead of returned.
 *
 * @example
 * const vcr = new VCR<PlanetScaleDatabase>();
 * vcr.loadFixture('planetscale/createDatabase');
 * const response = vcr.next(); // first fixture entry
 *
 * // Error injection for unhappy path
 * vcr.addError(new Error('PlanetScale API error (403): Forbidden'));
 * vcr.add({ id: 'db-1', name: 'template', ... }); // retry succeeds
 */
export class VCR<T> {
  private queue: Array<T | Error> = [];

  /** Replace entire queue */
  set(items: T[]): void {
    this.queue = [...items];
  }

  /** Append a successful response */
  add(item: T): void {
    this.queue.push(item);
  }

  /** Append an error (will be thrown on next()) */
  addError(error: Error): void {
    this.queue.push(error);
  }

  /**
   * Pop next item. Throws if it's an Error.
   * Returns undefined if queue is empty.
   */
  next(): T | undefined {
    const item = this.queue.shift();
    if (item instanceof Error) throw item;
    return item;
  }

  /**
   * Pop next item, throwing if queue is empty.
   * Use when the call MUST have a fixture response.
   */
  require(): T {
    if (this.queue.length === 0) {
      throw new Error('VCR queue exhausted — missing fixture data');
    }
    const item = this.queue.shift()!;
    if (item instanceof Error) throw item;
    return item;
  }

  clear(): void {
    this.queue = [];
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  size(): number {
    return this.queue.length;
  }
}
