import { describe, expect, it } from 'bun:test';
import { assertBatchable } from '#/modules/batch/services/assertBatchable';
import { createTestApp } from '#tests/createTestApp';

const { app } = createTestApp({
  mount: [
    (app) =>
      app.openAPIRegistry.registerPath({
        method: 'post',
        path: '/api/v1/organization/{id}/consent',
        'x-forbid-batch': true,
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

  it('treats a segment holding a reference, encoded or not, as reaching any route below it', () => {
    for (const reference of ['<<0.0.body.data.id>>', '%3C%3C0.0.body.data.id%3E%3E']) {
      expect(() =>
        assertBatchable(app, [
          [{ method: 'POST', path: `/api/v1/organization/${reference}/other` }],
        ]),
      ).toThrow('cannot run in a batch');
    }
  });

  it('reads an escaped bracket in a segment as literal text, not a reference', () => {
    const literalSegment = encodeURIComponent('\\<<draft\\>>');
    expect(() =>
      assertBatchable(app, [
        [{ method: 'POST', path: `/api/v1/organization/${literalSegment}/other` }],
      ]),
    ).not.toThrow();
  });
});
