import { sanitize, type SanitizeRule } from './sanitize';

type VCROptions = {
  /** Fixture name for auto-recording (e.g., 'anthropic/chatCompletion') */
  fixtureName?: string;
  /** Extra sanitize rules beyond defaults */
  sanitizeRules?: SanitizeRule[];
};

/**
 * VCR (Video Cassette Recorder) - Queue-based response manager
 *
 * Three modes:
 * 1. **Playback** — pre-loaded fixtures are popped FIFO
 * 2. **Error injection** — queue Error instances for unhappy path testing
 * 3. **Auto-record** — when queue is empty and a fallback is provided,
 *    calls the real function, sanitizes the response, saves a fixture,
 *    and returns the sanitized result.
 *
 * @example
 * // Playback (happy path)
 * const vcr = new VCR<AnthropicMessage>();
 * vcr.add(loadFixture('anthropic/chatCompletion'));
 * const response = vcr.next(); // fixture data
 *
 * // Error injection (unhappy path)
 * vcr.addError(new Error('API rate limit exceeded'));
 * vcr.add(successFixture); // retry succeeds
 *
 * // Auto-record (first run — no fixture exists)
 * const result = await vcr.playOrRecord(
 *   () => anthropic.messages.create({ ... }),
 *   { fixtureName: 'anthropic/chatCompletion' },
 * );
 */
export class VCR<T> {
  private queue: Array<T | Error> = [];
  private recorded: T[] = [];

  /**
   * Replace entire queue with new items
   */
  set(items: T[]): void {
    this.queue = [...items];
  }

  /**
   * Append item to end of queue
   */
  add(item: T): void {
    this.queue.push(item);
  }

  /**
   * Append an error (will be thrown on next()/get())
   */
  addError(error: Error): void {
    this.queue.push(error);
  }

  /**
   * Pop first item from queue (FIFO).
   * Throws if item is an Error. Returns undefined if empty.
   */
  get(): T | undefined {
    const item = this.queue.shift();
    if (item instanceof Error) throw item;
    return item;
  }

  /**
   * Alias for get() — matches init VCR naming
   */
  next(): T | undefined {
    return this.get();
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
   * On first run (no fixture), makes the real API call and creates the fixture.
   * On subsequent runs, plays back from the pre-loaded queue.
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

  /**
   * Empty the queue
   */
  clear(): void {
    this.queue = [];
    this.recorded = [];
  }

  /**
   * Check if queue has items
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get number of items in queue
   */
  size(): number {
    return this.queue.length;
  }
}
