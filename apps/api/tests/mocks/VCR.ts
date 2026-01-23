/**
 * VCR (Video Cassette Recorder) - Queue-based response manager
 *
 * Stores SDK-shaped responses that get popped off in FIFO order.
 * Tests can pre-load responses using fixtures or inline data.
 *
 * @example
 * const vcr = new VCR<EmbedResponse>();
 * vcr.set([response1, response2, response3]);
 *
 * const first = vcr.get();  // response1
 * const second = vcr.get(); // response2
 */
export class VCR<T> {
  private queue: T[] = [];

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
   * Pop first item from queue (FIFO)
   */
  get(): T | undefined {
    return this.queue.shift();
  }

  /**
   * Empty the queue
   */
  clear(): void {
    this.queue = [];
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
