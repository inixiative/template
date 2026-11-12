/**
 * @atlas
 * @kind schema
 * @partOf feature:users
 * @uses infrastructure:prisma
 */
import { UserScalarSchema } from '@template/db';

// The user as responses show it: jwtVersion is revocation state, so it is dropped from the row.
export const userResponseSchema = UserScalarSchema.omit({ jwtVersion: true }).strip();
