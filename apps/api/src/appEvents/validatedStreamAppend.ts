/**
 * @atlas
 * @kind type
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import type { StreamAppend } from '@template/shared/ws';

declare const validatedByStreamAppend: unique symbol;

export type ValidatedStreamAppend = StreamAppend & { readonly [validatedByStreamAppend]: true };
