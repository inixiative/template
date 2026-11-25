/**
 * @atlas
 * @kind util
 * @partOf feature:auth
 * @uses none
 */
import type { Env } from '#/config/env';

export const isTwoFactorRequired = (): boolean =>
  (process.env as unknown as Partial<Env>).REQUIRE_TWO_FACTOR === true;
