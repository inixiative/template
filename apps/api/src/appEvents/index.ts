/**
 * App Event Handlers
 *
 * Import this file in your app entry point to register all event handlers.
 */

// Observe bridge — persists every event to AppEvent table
import '#/appEvents/handlers/observe';

// Typed event definitions (registers bridge handlers via makeAppEvent)
import '#/appEvents/definitions';
