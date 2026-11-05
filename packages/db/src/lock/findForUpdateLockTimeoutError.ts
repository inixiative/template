/**
 * @atlas
 * @kind constructor
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
// `identifier` is the fenced key's identifier, `Model:hash`, or for a batch the first pending one
// plus the count of the rest: `Model:hash (+N)`. It carries no `lock:` prefix.
export class FindForUpdateLockTimeoutError extends Error {
  readonly model: string;
  readonly identifier: string;
  readonly waitMs: number;

  constructor(model: string, identifier: string, waitMs: number) {
    super(
      `db.findForUpdate(${model}, { upserting: true }) waited ${waitMs}ms for the key lock held by another transaction`,
    );
    this.name = 'FindForUpdateLockTimeoutError';
    this.model = model;
    this.identifier = identifier;
    this.waitMs = waitMs;
  }
}
