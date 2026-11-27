/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses none
 */
type BetterAuthError = { message?: string; statusText: string };

export const throwBetterAuthError = (error: BetterAuthError): never => {
  throw new Error(error.message || error.statusText);
};
