/**
 * @atlas
 * @kind constructor
 * @partOf infrastructure:prisma
 * @uses none
 */
export class RuleReferenceError extends Error {
  readonly details?: Record<string, unknown>[];

  constructor(message: string, details?: Record<string, unknown>[]) {
    super(message);
    this.name = 'RuleReferenceError';
    this.details = details;
  }
}
