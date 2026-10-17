/**
 * @atlas
 * @kind type
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
declare const validatedByStreamAppend: unique symbol;

export type ValidatedStreamAppend = { type: string; payload: unknown; revive?: true } & {
  readonly [validatedByStreamAppend]: true;
};
