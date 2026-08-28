import { describe, expect, it } from 'bun:test';
import { type ComponentSnapshot, recomposeFromSnapshots } from '#/lib/email/recompose';

const loaderFrom = (snapshots: Record<string, ComponentSnapshot>) => async (auditLogId: string) =>
  snapshots[auditLogId] ?? null;

describe('recomposeFromSnapshots', () => {
  it('injects caller overrides into the pinned child body instead of discarding them', async () => {
    const result = await recomposeFromSnapshots(
      'root',
      loaderFrom({
        root: {
          mjml: '{{#component:card}}{{#slot:body}}OVERRIDE{{/slot:body}}{{/component:card}}',
          componentVersions: { card: 'card-v1' },
        },
        'card-v1': { mjml: '<x>{{#slot:body:default}}DEFAULT{{/slot:body:default}}</x>', componentVersions: {} },
      }),
    );
    expect(result).toBe('<x>OVERRIDE</x>');
  });

  it('recomposes nested components through each snapshot version pin', async () => {
    const result = await recomposeFromSnapshots(
      'root',
      loaderFrom({
        root: { mjml: '{{#component:hero}}{{/component:hero}}', componentVersions: { hero: 'hero-v2' } },
        'hero-v2': {
          mjml: '{{#slot:body:default}}{{#component:cta}}{{/component:cta}}{{/slot:body:default}}',
          componentVersions: { cta: 'cta-v7' },
        },
        'cta-v7': { mjml: '<btn>Go</btn>', componentVersions: {} },
      }),
    );
    expect(result).toBe('<btn>Go</btn>');
  });

  it('renders a dangling pin (missing child snapshot) as empty rather than leaving raw grammar', async () => {
    const result = await recomposeFromSnapshots(
      'root',
      loaderFrom({
        root: { mjml: 'a{{#component:gone}}{{/component:gone}}b', componentVersions: { gone: null } },
      }),
    );
    expect(result).toBe('ab');
  });

  it('bounds a cyclic snapshot graph instead of recursing forever', async () => {
    const result = await recomposeFromSnapshots(
      'root',
      loaderFrom({
        root: { mjml: '{{#component:b}}{{/component:b}}', componentVersions: { b: 'b-v1' } },
        'b-v1': { mjml: 'B{{#component:a}}{{/component:a}}', componentVersions: { a: 'root' } },
      }),
    );
    expect(result).toBe('B');
  });

  it('returns null when the root snapshot is missing or has no mjml', async () => {
    expect(await recomposeFromSnapshots('missing', loaderFrom({}))).toBeNull();
  });
});
