import { describe, expect, it } from 'bun:test';
import { app } from '#/app';
import { get } from './utils/request';

type HealthResponse = { status: string; timestamp: string };

describe('GET /health', () => {
  it('returns ok status', async () => {
    const response = await app.fetch(get('/health'));
    const data = (await response.json()) as HealthResponse;

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });
});
