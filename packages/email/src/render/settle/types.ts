/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
export type RuleErrorSink = (message: string) => void;

export type Scope = Record<string, unknown>;

export type SettleOptions = { substitute: boolean; eachDepth?: number };
