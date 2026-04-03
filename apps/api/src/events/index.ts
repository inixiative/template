/**
 * App Event Handlers
 *
 * Import this file in your app entry point to register all event handlers.
 */

// Observe bridge — persists every event to AppEvent table
import '#/events/handlers/observe';

// Legacy wildcard WebSocket broadcast (backward compat for raw createAppEvent calls)
import '#/events/handlers/websocket';

// Typed event definitions (registers bridge handlers via makeAppEvent)
import '#/events/definitions';
