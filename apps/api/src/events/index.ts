/**
 * App Event Handlers
 *
 * Import this file in your app entry point to register all event handlers.
 */

// Legacy wildcard WebSocket broadcast (backward compat for raw createAppEvent calls)
import '#/events/handlers/websocket';

// Typed event definitions (registers bridge handlers via makeAppEvent)
import '#/events/definitions';
