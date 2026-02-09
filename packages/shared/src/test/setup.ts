import { afterAll, afterEach, beforeAll } from 'bun:test';
import { server } from '@template/shared/test/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
