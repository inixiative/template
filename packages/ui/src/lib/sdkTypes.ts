/**
 * @atlas
 * @kind type
 * @partOf primitive:ui
 * @uses none
 */
// biome-ignore lint/suspicious/noExplicitAny: function parameter contravariance requires any — see above
export type SdkFunction = (opts: any) => Promise<unknown>;
