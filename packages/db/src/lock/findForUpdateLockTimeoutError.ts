/**
 * @atlas
 * @kind constructor
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
// Thrown out of an upserting db.findForUpdate() whose where-key another transaction still holds
// past the wait, so the waiting transaction rolls back instead of racing the holder's insert.
export class FindForUpdateLockTimeoutError extends Error {
  readonly key: string;
  readonly waitMs: number;

  constructor(key: string, waitMs: number) {
    super(`db.findForUpdate(): timed out after ${waitMs}ms waiting for the upserting lock ${key}`);
    this.name = 'FindForUpdateLockTimeoutError';
    this.key = key;
    this.waitMs = waitMs;
  }
}
