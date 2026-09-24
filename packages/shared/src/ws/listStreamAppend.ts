/**
 * @atlas
 * @kind type
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
export type ListStreamAppend<T extends { id: string }> = { upsert: T } | { remove: string };
