/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
// The actor types that can hold a WS identity, named by their user model. Channel registry
// entries declare which actor may subscribe, the way routes declare an auth level. API tokens
// don't get WS identities; if one ever needs a socket (e.g. MCP), it becomes a new actor here.
export const WSActor = {
  USER: 'User',
} as const;

export type WSActor = (typeof WSActor)[keyof typeof WSActor];
