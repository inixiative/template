export type BroadcastRegistry<A> = {
  register: (name: string, adapter: A) => void;
  unregister: (name: string) => void;
  get: (name: string) => A;
  getOrDefault: (name: string | undefined, fallback: string) => A;
  /**
   * Run `fn` against every registered adapter. Each adapter runs in isolation
   * (one rejection does NOT short-circuit siblings). After all settle, if any
   * rejected, throw an `AggregateError` (or the lone error) so the caller can
   * surface the failure — silent swallowing was the previous bug.
   */
  broadcast: <R>(fn: (adapter: A) => Promise<R>) => Promise<R[]>;
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
    broadcast: async <R>(fn: (adapter: A) => Promise<R>): Promise<R[]> => {
      const settled = await Promise.allSettled(Array.from(map.values()).map(fn));
      const errors: unknown[] = [];
      const values: R[] = [];
      for (const result of settled) {
        if (result.status === 'fulfilled') values.push(result.value);
        else errors.push(result.reason);
      }
      if (errors.length === 1) throw errors[0] instanceof Error ? errors[0] : new Error(String(errors[0]));
      if (errors.length > 1) throw new AggregateError(errors, `${errors.length} broadcast adapter failures`);
      return values;
    },
    has: (name) => map.has(name),
    names: () => Array.from(map.keys()),
  };
};
