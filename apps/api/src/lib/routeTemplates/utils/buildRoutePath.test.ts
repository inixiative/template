import { describe, expect, it } from 'bun:test';
import { buildRoutePath } from '#/lib/routeTemplates/utils/buildRoutePath';

describe('buildRoutePath', () => {
  it('an action on a submodel collection sits under the pluralized submodel', () => {
    expect(buildRoutePath({ submodel: 'segment', action: 'reach', operation: 'action' })).toBe('/:id/segments/reach');
    expect(buildRoutePath({ submodel: 'segment', action: 'reach', skipId: true, operation: 'action' })).toBe(
      '/segments/reach',
    );
  });

  it('an action without a submodel keeps its bare shape', () => {
    expect(buildRoutePath({ action: 'redact', operation: 'action' })).toBe('/:id/redact');
    expect(buildRoutePath({ action: 'redact', skipId: true, operation: 'action' })).toBe('/redact');
  });
});
