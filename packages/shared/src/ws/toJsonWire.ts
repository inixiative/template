/**
 * @atlas
 * @kind helper
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
export type JsonWire<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? JsonWire<U>[]
    : T extends object
      ? { [K in keyof T]: JsonWire<T[K]> }
      : T;

export const toJsonWire = <T>(value: T): JsonWire<T> => JSON.parse(JSON.stringify(value)) as JsonWire<T>;
