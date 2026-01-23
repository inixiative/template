import { mock } from 'bun:test';
import type { PrismaClient } from '@prisma/client';

interface MockRecord {
  [key: string]: any;
}

interface MockStore {
  [model: string]: MockRecord[];
}

export const createDbMock = () => {
  const store: MockStore = {
    user: [],
    account: [],
    session: []
  };
  
  const createModelMock = (modelName: string) => ({
    findUnique: mock(async ({ where, include }: any) => {
      const records = store[modelName] || [];
      const record = records.find(r => {
        return Object.entries(where).every(([key, value]) => r[key] === value);
      });
      
      if (record && include) {
        // Simple include simulation
        Object.keys(include).forEach(relation => {
          if (include[relation] === true) {
            record[relation] = store[relation]?.filter(r => r[`${modelName}Id`] === record.id) || [];
          }
        });
      }
      
      return record || null;
    }),
    
    findFirst: mock(async ({ where, include }: any) => {
      const records = store[modelName] || [];
      const record = records.find(r => {
        if (!where) return true;
        return Object.entries(where).every(([key, value]) => r[key] === value);
      });
      
      if (record && include) {
        Object.keys(include).forEach(relation => {
          if (include[relation] === true) {
            record[relation] = store[relation]?.filter(r => r[`${modelName}Id`] === record.id) || [];
          }
        });
      }
      
      return record || null;
    }),
    
    findMany: mock(async ({ where, include }: any) => {
      let records = store[modelName] || [];
      
      if (where) {
        records = records.filter(r => {
          return Object.entries(where).every(([key, value]) => r[key] === value);
        });
      }
      
      if (include) {
        records = records.map(record => {
          const recordCopy = { ...record };
          Object.keys(include).forEach(relation => {
            if (include[relation] === true) {
              recordCopy[relation] = store[relation]?.filter(r => r[`${modelName}Id`] === record.id) || [];
            }
          });
          return recordCopy;
        });
      }
      
      return records;
    }),
    
    create: mock(async ({ data, include }: any) => {
      const id = data.id || Math.random().toString(36).substring(7);
      const now = new Date().toISOString();
      const record = {
        id,
        createdAt: now,
        updatedAt: now,
        ...data
      };
      
      store[modelName] = store[modelName] || [];
      store[modelName].push(record);
      
      if (include) {
        Object.keys(include).forEach(relation => {
          if (include[relation] === true) {
            record[relation] = [];
          }
        });
      }
      
      return record;
    }),
    
    update: mock(async ({ where, data, include }: any) => {
      const records = store[modelName] || [];
      const index = records.findIndex(r => {
        return Object.entries(where).every(([key, value]) => r[key] === value);
      });
      
      if (index === -1) return null;
      
      const updatedRecord = {
        ...records[index],
        ...data,
        updatedAt: new Date().toISOString()
      };
      
      records[index] = updatedRecord;
      
      if (include) {
        Object.keys(include).forEach(relation => {
          if (include[relation] === true) {
            updatedRecord[relation] = store[relation]?.filter(r => r[`${modelName}Id`] === updatedRecord.id) || [];
          }
        });
      }
      
      return updatedRecord;
    }),
    
    delete: mock(async ({ where }: any) => {
      const records = store[modelName] || [];
      const index = records.findIndex(r => {
        return Object.entries(where).every(([key, value]) => r[key] === value);
      });
      
      if (index === -1) return null;
      
      const deleted = records[index];
      records.splice(index, 1);
      
      return deleted;
    }),
    
    deleteMany: mock(async ({ where }: any) => {
      const records = store[modelName] || [];
      let deletedCount = 0;
      
      store[modelName] = records.filter(r => {
        const shouldDelete = !where || Object.entries(where).every(([key, value]) => r[key] === value);
        if (shouldDelete) deletedCount++;
        return !shouldDelete;
      });
      
      return { count: deletedCount };
    }),
    
    count: mock(async ({ where }: any) => {
      const records = store[modelName] || [];
      
      if (!where) return records.length;
      
      return records.filter(r => {
        return Object.entries(where).every(([key, value]) => r[key] === value);
      }).length;
    })
  });
  
  const db = {
    user: createModelMock('user'),
    account: createModelMock('account'),
    session: createModelMock('session'),
    
    $transaction: mock(async (operations: any) => {
      if (typeof operations === 'function') {
        return await operations(db);
      }
      return await Promise.all(operations);
    }),
    
    // Test helper to clear all data
    $clearAll: () => {
      Object.keys(store).forEach(key => {
        store[key] = [];
      });
    },
    
    // Test helper to get raw store (for debugging)
    $getStore: () => store
  };
  
  return db as any;
};