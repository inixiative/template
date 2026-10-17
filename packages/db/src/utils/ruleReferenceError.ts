/**
 * @atlas
 * @kind constructor
 * @partOf infrastructure:prisma
 * @uses none
 */
export class RuleReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleReferenceError';
  }
}
