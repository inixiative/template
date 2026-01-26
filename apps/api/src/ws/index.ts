// Handler for Bun.serve()
export { handleUpgrade, websocketHandler } from '#/ws/handler';

// Broadcasting utilities (cross-server via Redis pub/sub)
export {
  sendToUser,
  sendToChannel,
  broadcast,
  initWebSocketPubSub,
  isPubSubEnabled,
} from '#/ws/pubsub';

// Local connection management
export { getConnectionStats, drainConnections } from '#/ws/connections';

// Types
export type { WSData, WSMessage, WSSocket } from '#/ws/types';
