import { describe, expect, it } from 'bun:test';
import { expandWith, type LookupComponents } from '@template/email/render/expand';

const lookupFrom =
  (bodies: Record<string, string>, calls: string[][] = []): LookupComponents =>
  async (slugs) => {
    calls.push([...slugs]);
    return Object.fromEntries(
      slugs.map((slug) => [slug, bodies[slug] === undefined ? undefined : { mjml: bodies[slug] }]),
    );
  };

const render = (mjml: string, bodies: Record<string, string>, calls?: string[][]) =>
  expandWith(mjml, lookupFrom(bodies, calls));

const reexposing = {
  b: '{{#component:c}}{{#slot:body}}{{#slot:heading:default}}B default{{/slot:heading:default}}{{/slot:body}}{{/component:c}}',
  c: '<x>{{#slot:body:default}}C default{{/slot:body:default}}</x>',
};

describe('expand', () => {
  describe('plain content and bare refs', () => {
    it('returns plain content unchanged', async () => {
      expect(await render('<mj-text>Hi</mj-text>', {})).toBe('<mj-text>Hi</mj-text>');
    });

    it('renders a loaded component body for a bare ref', async () => {
      expect(await render('{{#component:card}}{{/component:card}}', { card: '<x>Card</x>' })).toBe('<x>Card</x>');
    });
  });

  describe('one-level slots', () => {
    it('injects a caller override at the matching slot marker', async () => {
      const out = await render('{{#component:card}}{{#slot:body}}OVERRIDE{{/slot:body}}{{/component:card}}', {
        card: '<x>{{#slot:body:default}}DEFAULT{{/slot:body:default}}</x>',
      });
      expect(out).toBe('<x>OVERRIDE</x>');
    });

    it('renders the default when the caller provides no override', async () => {
      const out = await render('{{#component:card}}{{/component:card}}', {
        card: '<x>{{#slot:body:default}}DEFAULT{{/slot:body:default}}</x>',
      });
      expect(out).toBe('<x>DEFAULT</x>');
    });

    it('renders an empty default in place (holds position)', async () => {
      const out = await render('{{#component:card}}{{/component:card}}', {
        card: '<x>{{#slot:body:default}}{{/slot:body:default}}</x>',
      });
      expect(out).toBe('<x></x>');
    });

    it('blanks the slot on an empty override (holds position over the default)', async () => {
      const out = await render('{{#component:card}}{{#slot:body}}{{/slot:body}}{{/component:card}}', {
        card: '<x>{{#slot:body:default}}DEFAULT{{/slot:body:default}}</x>',
      });
      expect(out).toBe('<x></x>');
    });

    it('fills a default slot nested inside another default slot of the same body', async () => {
      const out = await render('{{#component:card}}{{#slot:inner}}FILL{{/slot:inner}}{{/component:card}}', {
        card: '{{#slot:outer:default}}[{{#slot:inner:default}}D{{/slot:inner:default}}]{{/slot:outer:default}}',
      });
      expect(out).toBe('[FILL]');
    });

    it('lets an enclosing slot consume the fill, leaving a shadowed same-name descendant unreached', async () => {
      const card =
        '{{#slot:heading:default}}outer [{{#slot:heading:default}}inner{{/slot:heading:default}}]{{/slot:heading:default}}';

      const filled = await render('{{#component:card}}{{#slot:heading}}FILL{{/slot:heading}}{{/component:card}}', {
        card,
      });
      const unfilled = await render('{{#component:card}}{{/component:card}}', { card });

      expect(filled).toBe('FILL');
      expect(unfilled).toBe('outer [inner]');
    });

    it('two refs to the same component render their own fills independently', async () => {
      const out = await render(
        '{{#component:card}}{{#slot:body}}ONE{{/slot:body}}{{/component:card}}' +
          '{{#component:card}}{{#slot:body}}TWO{{/slot:body}}{{/component:card}}',
        { card: '<x>{{#slot:body:default}}D{{/slot:body:default}}</x>' },
      );
      expect(out).toBe('<x>ONE</x><x>TWO</x>');
    });
  });

  describe('nested components', () => {
    it('recurses into a component nested inside a default', async () => {
      const out = await render('{{#component:card}}{{/component:card}}', {
        card: '{{#slot:body:default}}{{#component:cta}}{{/component:cta}}{{/slot:body:default}}',
        cta: '<btn>Go</btn>',
      });
      expect(out).toBe('<btn>Go</btn>');
    });

    it('recurses into a component inside a caller override', async () => {
      const out = await render(
        '{{#component:card}}{{#slot:body}}{{#component:cta}}{{/component:cta}}{{/slot:body}}{{/component:card}}',
        { card: '<x>{{#slot:body:default}}D{{/slot:body:default}}</x>', cta: 'CTA' },
      );
      expect(out).toBe('<x>CTA</x>');
    });

    it('renders the nesting regression: parent ships child pre-filled', async () => {
      const out = await render('{{#component:hero}}{{/component:hero}}', {
        hero: '{{#slot:body:default}}{{#component:cta}}{{#slot:label}}Get started{{/slot:label}}{{/component:cta}}{{/slot:body:default}}',
        cta: '<btn>{{#slot:label:default}}Fallback{{/slot:label:default}}</btn>',
      });
      expect(out).toBe('<btn>Get started</btn>');
    });
  });

  describe('concentric slot pass-through', () => {
    it('fills a slot re-exposed inside a nested component override', async () => {
      const out = await render('{{#component:b}}{{#slot:heading}}From A{{/slot:heading}}{{/component:b}}', reexposing);
      expect(out).toBe('<x>From A</x>');
    });

    it('carries a fill three levels deep: a fills b, b re-exposes into c', async () => {
      const out = await render('{{#component:a}}{{/component:a}}', {
        a: '{{#component:b}}{{#slot:heading}}From A{{/slot:heading}}{{/component:b}}',
        ...reexposing,
      });
      expect(out).toBe('<x>From A</x>');
    });

    it('falls back to the re-exposed default when the caller supplies no fill', async () => {
      const out = await render('{{#component:b}}{{/component:b}}', reexposing);
      expect(out).toBe('<x>B default</x>');
    });

    it('blanks a re-exposed slot on an empty fill (holds position)', async () => {
      const out = await render('{{#component:b}}{{#slot:heading}}{{/slot:heading}}{{/component:b}}', reexposing);
      expect(out).toBe('<x></x>');
    });
  });

  describe('cycles', () => {
    it('throws a typed circular_ref with the path on a mutual cycle instead of recursing forever', async () => {
      await expect(
        render('{{#component:a}}{{/component:a}}', {
          a: '{{#component:b}}{{/component:b}}',
          b: '{{#component:a}}{{/component:a}}',
        }),
      ).rejects.toMatchObject({ slug: 'a', type: 'circular_ref', path: ['a', 'b', 'a'] });
    });

    it('throws circular_ref on a self-reference carried by a component default body', async () => {
      await expect(
        render('{{#component:card}}{{/component:card}}', {
          card: '{{#slot:body:default}}{{#component:card}}{{/component:card}}{{/slot:body:default}}',
        }),
      ).rejects.toMatchObject({ slug: 'card', type: 'circular_ref', path: ['card', 'card'] });
    });

    it('does not false-positive a component nested inside its own override slot', async () => {
      const out = await render(
        '{{#component:card}}{{#slot:body}}{{#component:card}}{{/component:card}}{{/slot:body}}{{/component:card}}',
        { card: '<x>{{#slot:body:default}}D{{/slot:body:default}}</x>' },
      );
      expect(out).toBe('<x><x>D</x></x>');
    });
  });

  describe('lookup', () => {
    it('throws component_missing when the lookup has no row', async () => {
      await expect(render('{{#component:missing}}{{/component:missing}}', {})).rejects.toMatchObject({
        slug: 'missing',
        type: 'component_missing',
      });
    });

    it('throws component_missing for a ref nested inside a loaded body', async () => {
      await expect(
        render('{{#component:card}}{{/component:card}}', { card: '{{#component:missing}}{{/component:missing}}' }),
      ).rejects.toMatchObject({ slug: 'missing', type: 'component_missing' });
    });

    it('batches each level once and caches shared descendants', async () => {
      const calls: string[][] = [];
      const out = await render(
        '{{#component:left}}{{/component:left}}{{#component:right}}{{/component:right}}',
        {
          left: '{{#component:shared}}{{/component:shared}}',
          right: '{{#component:shared}}{{/component:shared}}',
          shared: '<mj-text>Shared</mj-text>',
        },
        calls,
      );

      expect(out).toBe('<mj-text>Shared</mj-text><mj-text>Shared</mj-text>');
      expect(calls).toEqual([['left', 'right'], ['shared']]);
    });

    it('looks up a slug referenced twice at one level exactly once', async () => {
      const calls: string[][] = [];
      await render(
        '{{#component:card}}{{#slot:body}}ONE{{/slot:body}}{{/component:card}}' +
          '{{#component:card}}{{#slot:body}}TWO{{/slot:body}}{{/component:card}}',
        { card: '<x>{{#slot:body:default}}D{{/slot:body:default}}</x>' },
        calls,
      );
      expect(calls).toEqual([['card']]);
    });

    it('does not treat inherited object keys as components', async () => {
      const lookup: LookupComponents = async () => ({});
      await expect(expandWith('{{#component:constructor}}{{/component:constructor}}', lookup)).rejects.toMatchObject({
        slug: 'constructor',
        type: 'component_missing',
      });
    });
  });
});
