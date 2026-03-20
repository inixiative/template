import { sanitize, type SanitizeRule } from './sanitize';

type VCROptions = {
  /** Fixture name for auto-recording (e.g., 'planetscale/createDatabase') */
  fixtureName?: string;
  /** Extra sanitize rules beyond defaults */
  sanitizeRules?: SanitizeRule[];
};

/**
 * VCR (Video Cassette Recorder) - Queue-based response manager for init tests
 *
 * Three modes:
 * 1. **Playback** — pre-loaded fixtures are popped FIFO (normal test mode)
 * 2. **Error injection** — queue Error instances for unhappy path testing
 * 3. **Auto-record** — when queue is empty and a fallback is provided,
 *    calls the real function, sanitizes the response, saves a fixture,
 *    and returns the sanitized result.
 *
 * @example
 * // Playback mode (happy path)
 * const vcr = new VCR<PlanetScaleDatabase>();
 * vcr.add(loadFixture('planetscale/createDatabase'));
 * const response = vcr.next(); // fixture data
 *
 * // Error injection (unhappy path)
 * vcr.addError(new Error('PlanetScale API error (403): Forbidden'));
 * vcr.add(successFixture); // retry succeeds
 *
 * // Auto-record mode (first run — no fixture exists yet)
 * const result = await vcr.playOrRecord(
 *   () => createDatabase(org, db, region),
 *   { fixtureName: 'planetscale/createDatabase' },
 * );
 */
export class VCR<T> {
  private queue: Array<T | Error> = [];
  private recorded: T[] = [];

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

  /**
   * Play from queue if available, otherwise call the real function,
   * sanitize the result, optionally save it as a fixture, and return it.
   *
   * This is the key auto-record method: on first run (no fixture),
   * it makes the real API call and creates the fixture file.
   * On subsequent runs, it plays back from the pre-loaded queue.
   */
  async playOrRecord(realCall: () => Promise<T>, options: VCROptions = {}): Promise<T> {
    // If queue has items, play back
    if (this.queue.length > 0) {
      return this.require();
    }

    // Queue empty — make the real call and record
    const raw = await realCall();
    const sanitized = sanitize(raw, options.sanitizeRules);

    this.recorded.push(sanitized);

    // Auto-save fixture if name provided
    if (options.fixtureName) {
      const { recordFixture } = await import('./sanitize');
      recordFixture(options.fixtureName, raw, options.sanitizeRules);
    }

    return sanitized;
  }

  /** Get all items recorded via playOrRecord (for assertions) */
  getRecorded(): T[] {
    return [...this.recorded];
  }

  clear(): void {
    this.queue = [];
    this.recorded = [];
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  size(): number {
    return this.queue.length;
  }
}
