/**
 * @atlas
 * @kind constructor
 * @partOf infrastructure:redis, mutex
 * @uses none
 */
export class LockLostError extends Error {
  readonly key: string;

  constructor(key: string) {
    super(`Lost the lock ${key} before the work it guards finished`);
    this.name = 'LockLostError';
    this.key = key;
  }
}
