import { describe, expect, it } from 'bun:test';
import { assertBatchable } from '#/modules/batch/services/assertBatchable';
import { createTestApp } from '#tests/createTestApp';

const { app } = createTestApp({
  mount: [
    (app) =>
      app.openAPIRegistry.registerPath({
        method: 'post',
        path: '/api/v1/organization/{id}/consent',
        'x-batch': false,
        responses: {},
      }),
  ],
});

describe('assertBatchable', () => {
  it('refuses a request to an unbatchable route whose path has a parameter', () => {
    expect(() =>
      assertBatchable(app, [[{ method: 'POST', path: '/api/v1/organization/abc/consent' }]]),
    ).toThrow('cannot run in a batch');
  });

  it('admits a request to another route under the same parameter', () => {
    expect(() =>
      assertBatchable(app, [[{ method: 'POST', path: '/api/v1/organization/abc/other' }]]),
    ).not.toThrow();
  });
});
