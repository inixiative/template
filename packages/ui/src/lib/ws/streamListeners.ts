/**
 * @atlas
 * @kind registry
 * @partOf primitive:ui, primitive:websockets
 * @uses none
 */
type Listener = (payload: unknown) => void;

const listenersByStream = new Map<string, Map<string, Set<Listener>>>();

export const addStreamListener = (stream: string, type: string, listener: Listener): (() => void) => {
  const byType = listenersByStream.get(stream) ?? new Map<string, Set<Listener>>();
  const listeners = byType.get(type) ?? new Set<Listener>();
  listeners.add(listener);
  byType.set(type, listeners);
  listenersByStream.set(stream, byType);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) byType.delete(type);
    if (byType.size === 0) listenersByStream.delete(stream);
  };
};

export const notifyStreamListeners = (stream: string, type: string, payload: unknown): void => {
  for (const listener of [...(listenersByStream.get(stream)?.get(type) ?? [])]) {
    try {
      listener(payload);
    } catch (error) {
      console.error(`ws stream listener failed (${stream} ${type})`, error);
    }
  }
};
