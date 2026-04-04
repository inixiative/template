export type BroadcastRegistry<A> = {
  register: (name: string, adapter: A) => void;
  unregister: (name: string) => void;
  get: (name: string) => A;
  getOrDefault: (name: string | undefined, fallback: string) => A;
  broadcast: <R>(fn: (adapter: A) => Promise<R>) => Promise<PromiseSettledResult<R>[]>;
  has: (name: string) => boolean;
  names: () => string[];
};

export const makeBroadcastRegistry = <A>(): BroadcastRegistry<A> => {
  const map = new Map<string, A>();
  return {
    register: (name, adapter) => {
      map.set(name, adapter);
    },
    unregister: (name) => {
      map.delete(name);
    },
    get: (name) => {
      const adapter = map.get(name);
      if (!adapter) throw new Error(`Adapter not found: ${name}`);
      return adapter;
    },
    getOrDefault: (name, fallback) => {
      const adapter = name !== undefined ? map.get(name) : undefined;
      if (adapter) return adapter;
      const defaultAdapter = map.get(fallback);
      if (!defaultAdapter) throw new Error(`Default adapter not found: ${fallback}`);
      return defaultAdapter;
    },
    broadcast: async (fn) => {
      return Promise.allSettled(Array.from(map.values()).map(fn));
    },
    has: (name) => map.has(name),
    names: () => Array.from(map.keys()),
  };
};
