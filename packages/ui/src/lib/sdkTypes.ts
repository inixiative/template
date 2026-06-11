/**
 * @atlas
 * @kind type
 * @partOf primitive:ui
 */
// biome-ignore lint/suspicious/noExplicitAny: function parameter contravariance requires any — see above
export type SdkFunction = (opts: any) => Promise<unknown>;
