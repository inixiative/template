/**
 * Generic constraint for hey-api SDK functions and SDK-wrapping lambdas.
 *
 * Uses `any` in the parameter position because TypeScript's function parameter
 * contravariance makes it impossible to write a sound generic constraint that
 * accepts all SDK function signatures (each with unique Options<TData>) without it.
 *
 * The return type is constrained to Promise<unknown> — only the parameter needs any.
 * Concrete types are recovered at each call site via Parameters<TFn>[0] and ReturnType<TFn>.
 */
// biome-ignore lint/suspicious/noExplicitAny: function parameter contravariance requires any — see above
export type SdkFunction = (opts: any) => Promise<unknown>;
