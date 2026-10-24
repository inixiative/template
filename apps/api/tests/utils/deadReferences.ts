import { expect } from 'bun:test';
import { AppError } from '#/lib/errors';

export const deadReferencesOf = async (pending: Promise<unknown>): Promise<unknown[]> => {
  const error = await pending.then(
    () => undefined,
    (refusal: unknown) => refusal,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).status).toBe(422);
  return ((await (error as AppError).getResponse().json()) as { details: unknown[] }).details;
};
