import { describe, expect, it } from 'bun:test';
import { Prisma } from '@template/db';
import { HTTPException } from 'hono/http-exception';
import { makeError } from '#/lib/errors';
import { createTestApp } from '#tests/createTestApp';
import { get, jsonError } from '#tests/utils/request';

const { fetch } = createTestApp({
  mount: [
    (app) => {
      app.get('/plain', () => {
        throw new HTTPException(409, { message: 'Signet revision changed' });
      });
      app.get('/plain-empty', () => {
        throw new HTTPException(403);
      });
      app.get('/plain-unmapped', () => {
        throw new HTTPException(418, { message: 'Short and stout' });
      });
      app.get('/plain-with-res', () => {
        throw new HTTPException(401, {
          res: new Response('Unauthorized', {
            status: 401,
            headers: {
              'WWW-Authenticate': 'Bearer',
              'Content-Type': 'text/plain',
              'Content-Language': 'en',
            },
          }),
        });
      });
      app.get('/app-error', () => {
        throw makeError({ status: 404, message: 'Library owner mismatch' });
      });
      app.get('/prisma-missing', () => {
        throw new Prisma.PrismaClientKnownRequestError('missing', {
          code: 'P2025',
          clientVersion: Prisma.prismaVersion.client,
        });
      });
      app.get('/raw', () => {
        throw new Error('boom');
      });
    },
  ],
});

const expectEnvelope = async (response: Response, expected: Record<string, unknown>) => {
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('cache-control')).toBe('no-store');
  const body = await jsonError(response);
  expect(body).toMatchObject(expected);
  expect(body.requestId).toEqual(expect.any(String));
  expect(response.headers.get('request-id')).toBe(body.requestId);
  return body;
};

describe('errorHandlerMiddleware', () => {
  it('turns a plain HTTPException into the envelope with its status and message', async () => {
    const response = await fetch(get('/plain'));

    expect(response.status).toBe(409);
    await expectEnvelope(response, {
      error: 'CONFLICT',
      message: 'Signet revision changed',
      guidance: 'fixInput',
    });
  });

  it('falls back to the status name when a plain HTTPException has no message', async () => {
    const response = await fetch(get('/plain-empty'));

    expect(response.status).toBe(403);
    await expectEnvelope(response, {
      error: 'PERMISSION_DENIED',
      message: 'Forbidden',
      guidance: 'requestPermission',
    });
  });

  it('keeps an unmapped status and labels it by its class', async () => {
    const response = await fetch(get('/plain-unmapped'));

    expect(response.status).toBe(418);
    await expectEnvelope(response, { error: 'BAD_REQUEST', message: 'Short and stout' });
  });

  it('keeps the non-body headers of a plain HTTPException response but answers JSON', async () => {
    const response = await fetch(get('/plain-with-res'));

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer');
    expect(response.headers.get('content-language')).toBeNull();
    await expectEnvelope(response, { error: 'AUTHENTICATION_FAILED', message: 'Unauthorized' });
  });

  it('stamps the request id on a makeError response', async () => {
    const response = await fetch(get('/app-error'));

    expect(response.status).toBe(404);
    await expectEnvelope(response, {
      error: 'RESOURCE_NOT_FOUND',
      message: 'Library owner mismatch',
    });
  });

  it('stamps the request id on a translated Prisma error', async () => {
    const response = await fetch(get('/prisma-missing'));

    expect(response.status).toBe(404);
    await expectEnvelope(response, { message: 'Resource not found' });
  });

  it('stamps the request id on the generic 500', async () => {
    const response = await fetch(get('/raw'));

    expect(response.status).toBe(500);
    await expectEnvelope(response, { error: 'SERVER_ERROR', message: 'boom' });
  });

  it('stamps the request id on an unmatched route', async () => {
    const response = await fetch(get('/nowhere'));

    expect(response.status).toBe(404);
    const body = await jsonError(response);
    expect(body).toMatchObject({ error: 'RESOURCE_NOT_FOUND' });
    expect(body.requestId).toEqual(expect.any(String));
  });
});
