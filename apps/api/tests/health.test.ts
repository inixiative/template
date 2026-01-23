import { describe, expect, it } from 'bun:test';
import { app } from '@src/app';
import { get } from './utils/request';

describe('GET /health', () => {
  it('returns ok status', async () => {
    const response = await app.fetch(get('/health'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });
});
