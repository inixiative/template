// Handler for Bun.serve()

// Local connection management
export { drainConnections, getConnectionStats } from '#/ws/connections';
export { handleUpgrade, websocketHandler } from '#/ws/handler';
// Broadcasting utilities (cross-server via Redis pub/sub)
export {
  broadcast,
  initWebSocketPubSub,
  isPubSubEnabled,
  sendToChannel,
  sendToUser,
} from '#/ws/pubsub';

// Types
export type { WSData, WSMessage, WSSocket } from '#/ws/types';
