import { Elysia } from 'elysia';
import { app } from 'src/app/app';

export interface TestApp extends Elysia {
  cache: {
    db: any;
    redis: any;
    auth: any;
    user: any;
  };
  reset: () => void;
  registerMock: (key: string, mock: any) => void;
}

// Global singleton test app
let globalTestApp: TestApp | null = null;

export const createTestApp = async (): Promise<TestApp> => {
  // Return existing instance if available
  if (globalTestApp) return globalTestApp;
  
  console.log('Creating test app...');
  
  // Create the app instance
  const testApp = app as any;
  
  // Cache original decorators
  testApp.cache = {
    db: testApp.decorator.db,
    redis: testApp.decorator.redis,
    auth: testApp.decorator.auth,
    user: testApp.decorator.user
  };
  
  // Reset method to restore cached decorators
  testApp.reset = () => {
    Object.entries(testApp.cache).forEach(([key, value]) => {
      if (value !== undefined) {
        testApp.decorate(key, value);
      }
    });
  };
  
  // Mock registration method
  testApp.registerMock = (key: string, mock: any) => {
    if (!(key in testApp.cache)) {
      throw new Error(`${key} is not a registered decorator`);
    }
    testApp.decorate(key, mock);
  };
  
  globalTestApp = testApp;
  return globalTestApp;
};

// Reset the global test app (useful for test isolation)
export const resetGlobalTestApp = () => {
  if (globalTestApp) {
    globalTestApp.reset();
  }
  globalTestApp = null;
};