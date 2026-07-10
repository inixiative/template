/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
// The actor types that can hold a WS identity, named by their model. Channel registry entries
// declare which actor may subscribe, the way routes declare an auth level.
export const WSActor = {
  User: 'User',
  Token: 'Token',
} as const;

export type WSActor = (typeof WSActor)[keyof typeof WSActor];
