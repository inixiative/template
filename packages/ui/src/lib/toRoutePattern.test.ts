import { describe, expect, it } from 'bun:test';
import { toRoutePattern } from '@template/ui/lib/toRoutePattern';

describe('toRoutePattern', () => {
  it('turns each OpenAPI parameter into a :param segment', () => {
    expect(toRoutePattern('/api/v1/space/{id}/segments/{segmentId}')).toBe(
      '/api/v1/space/:id/segments/:segmentId',
    );
  });

  it('leaves a path without parameters as it is', () => {
    expect(toRoutePattern('/api/v1/me')).toBe('/api/v1/me');
  });
});
