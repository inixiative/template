import { mock } from 'bun:test';

interface MockRedisStore {
  [key: string]: string;
}

export const createRedisMock = () => {
  const cacheStore: MockRedisStore = {};
  const queueStore: MockRedisStore = {};
  
  const createRedisInstance = (store: MockRedisStore) => ({
    get: mock(async (key: string) => store[key] || null),
    
    set: mock(async (key: string, value: string) => {
      store[key] = value;
      return 'OK';
    }),
    
    setex: mock(async (key: string, ttl: number, value: string) => {
      store[key] = value;
      return 'OK';
    }),
    
    del: mock(async (...keys: string[]) => {
      let deleted = 0;
      keys.forEach(key => {
        if (store[key]) {
          delete store[key];
          deleted++;
        }
      });
      return deleted;
    }),
    
    keys: mock(async (pattern: string) => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return Object.keys(store).filter(key => regex.test(key));
    }),
    
    flushdb: mock(async () => {
      Object.keys(store).forEach(key => delete store[key]);
      return 'OK';
    }),
    
    scanStream: mock(() => {
      const allKeys = Object.keys(store);
      return {
        async *[Symbol.asyncIterator]() {
          const batchSize = 100;
          for (let i = 0; i < allKeys.length; i += batchSize) {
            yield allKeys.slice(i, i + batchSize);
          }
        }
      };
    }),
    
    pipeline: mock(() => {
      const commands: Array<[string, ...any[]]> = [];
      const pipelineObj = {
        del: mock((key: string) => {
          commands.push(['del', key]);
          return pipelineObj;
        }),
        exec: mock(async () => {
          const results: Array<[Error | null, any]> = [];
          for (const [cmd, ...args] of commands) {
            if (cmd === 'del' && store[args[0]]) {
              delete store[args[0]];
              results.push([null, 1]);
            } else {
              results.push([null, 0]);
            }
          }
          return results;
        })
      };
      return pipelineObj;
    })
  });
  
  return {
    cache: createRedisInstance(cacheStore),
    queue: createRedisInstance(queueStore)
  };
};