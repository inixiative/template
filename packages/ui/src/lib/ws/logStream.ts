/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses none
 */
export type LogStreamState<E = unknown> = { data: E[] };

const append = <S extends LogStreamState<E>, E>(state: S, entry: E): S => ({
  ...state,
  data: [...state.data, entry],
});

const snapshot = <S extends LogStreamState>(_previous: S | undefined, next: S): S => next;

export const logStream = { snapshot, ops: { append } };
