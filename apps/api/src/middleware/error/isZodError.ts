/**
 * @atlas
 * @kind middleware, error
 * @partOf primitive:errors
 * @uses none
 */
import { ZodError } from 'zod';

export const isZodError = (err: unknown): err is ZodError => {
  return err instanceof ZodError;
};
