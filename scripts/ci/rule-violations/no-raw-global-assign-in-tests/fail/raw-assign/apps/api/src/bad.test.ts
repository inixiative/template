// Forbidden: raw globalThis assignment in a test file. Should use spyOn.
globalThis.fetch = (() => Promise.resolve(new Response('hi'))) as typeof fetch;
