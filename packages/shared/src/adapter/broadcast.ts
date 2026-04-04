export type BroadcastRegistry<A> = {
  register: (name: string, adapter: A) => void;
  unregister: (name: string) => void;
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
    broadcast: async (fn) => {
      return Promise.allSettled(Array.from(map.values()).map(fn));
    },
    has: (name) => map.has(name),
    names: () => Array.from(map.keys()),
  };
};
