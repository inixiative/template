import { afterEach, mock, spyOn } from 'bun:test';

afterEach(() => mock.restore());

spyOn(globalThis, 'fetch').mockImplementation(
  (() => Promise.resolve(new Response('ok'))) as typeof fetch,
);
