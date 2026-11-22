import { expect } from 'bun:test';
import { RuleReferenceError } from '@template/db';

export const expectRuleReferenceErrorDeadReferences = async (
  pending: Promise<unknown>,
): Promise<unknown[]> => {
  const error = await pending.then(
    () => undefined,
    (refusal: unknown) => refusal,
  );
  expect(error).toBeInstanceOf(RuleReferenceError);
  return (error as RuleReferenceError).details ?? [];
};
