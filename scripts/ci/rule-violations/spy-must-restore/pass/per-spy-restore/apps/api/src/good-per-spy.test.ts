import { afterEach, spyOn } from 'bun:test';

const fetchSpy = spyOn(globalThis, 'fetch');
afterEach(() => fetchSpy.mockRestore());
