import { describe, expect, it } from 'bun:test';
import { renderBlocks } from '@template/email/render/renderBlocks';

const loaderFrom =
  (bodies: Record<string, string>) =>
  async (slug: string): Promise<string> => {
    const body = bodies[slug];
    if (body === undefined) throw new Error(`missing:${slug}`);
    return body;
  };

describe('renderBlocks', () => {
  it('returns plain content unchanged', async () => {
    expect(await renderBlocks('<mj-text>Hi</mj-text>', loaderFrom({}))).toBe('<mj-text>Hi</mj-text>');
  });

  it('renders a loaded component body for a bare ref', async () => {
    const out = await renderBlocks('{{#component:card}}{{/component:card}}', loaderFrom({ card: '<x>Card</x>' }));
    expect(out).toBe('<x>Card</x>');
  });

  it('injects a caller override at the matching slot marker', async () => {
    const out = await renderBlocks(
      '{{#component:card}}{{#slot:body}}OVERRIDE{{/slot:body}}{{/component:card}}',
      loaderFrom({ card: '<x>{{#slot:body:default}}DEFAULT{{/slot:body:default}}</x>' }),
    );
    expect(out).toBe('<x>OVERRIDE</x>');
  });

  it('renders the default when the caller provides no override', async () => {
    const out = await renderBlocks(
      '{{#component:card}}{{/component:card}}',
      loaderFrom({ card: '<x>{{#slot:body:default}}DEFAULT{{/slot:body:default}}</x>' }),
    );
    expect(out).toBe('<x>DEFAULT</x>');
  });

  it('renders an empty default in place (holds position)', async () => {
    const out = await renderBlocks(
      '{{#component:card}}{{/component:card}}',
      loaderFrom({ card: '<x>{{#slot:body:default}}{{/slot:body:default}}</x>' }),
    );
    expect(out).toBe('<x></x>');
  });

  it('fills a default slot nested inside another default slot of the same body', async () => {
    const out = await renderBlocks(
      '{{#component:card}}{{#slot:inner}}FILL{{/slot:inner}}{{/component:card}}',
      loaderFrom({
        card: '{{#slot:outer:default}}[{{#slot:inner:default}}D{{/slot:inner:default}}]{{/slot:outer:default}}',
      }),
    );
    expect(out).toBe('[FILL]');
  });

  it('lets an enclosing slot consume the fill, leaving a shadowed same-name descendant unreached', async () => {
    const card =
      '{{#slot:heading:default}}outer [{{#slot:heading:default}}inner{{/slot:heading:default}}]{{/slot:heading:default}}';

    const filled = await renderBlocks(
      '{{#component:card}}{{#slot:heading}}FILL{{/slot:heading}}{{/component:card}}',
      loaderFrom({ card }),
    );
    const unfilled = await renderBlocks('{{#component:card}}{{/component:card}}', loaderFrom({ card }));

    expect(filled).toBe('FILL');
    expect(unfilled).toBe('outer [inner]');
  });

  it('recurses into a component nested inside a default', async () => {
    const out = await renderBlocks(
      '{{#component:card}}{{/component:card}}',
      loaderFrom({
        card: '{{#slot:body:default}}{{#component:cta}}{{/component:cta}}{{/slot:body:default}}',
        cta: '<btn>Go</btn>',
      }),
    );
    expect(out).toBe('<btn>Go</btn>');
  });

  it('recurses into a component inside a caller override', async () => {
    const out = await renderBlocks(
      '{{#component:card}}{{#slot:body}}{{#component:cta}}{{/component:cta}}{{/slot:body}}{{/component:card}}',
      loaderFrom({ card: '<x>{{#slot:body:default}}D{{/slot:body:default}}</x>', cta: 'CTA' }),
    );
    expect(out).toBe('<x>CTA</x>');
  });

  it('renders the nesting regression: parent ships child pre-filled', async () => {
    const out = await renderBlocks(
      '{{#component:hero}}{{/component:hero}}',
      loaderFrom({
        hero: '{{#slot:body:default}}{{#component:cta}}{{#slot:label}}Get started{{/slot:label}}{{/component:cta}}{{/slot:body:default}}',
        cta: '<btn>{{#slot:label:default}}Fallback{{/slot:label:default}}</btn>',
      }),
    );
    expect(out).toBe('<btn>Get started</btn>');
  });

  it('fills a slot re-exposed inside a nested component override', async () => {
    const out = await renderBlocks(
      '{{#component:b}}{{#slot:heading}}From A{{/slot:heading}}{{/component:b}}',
      loaderFrom({
        b: '{{#component:c}}{{#slot:body}}{{#slot:heading:default}}B default{{/slot:heading:default}}{{/slot:body}}{{/component:c}}',
        c: '<x>{{#slot:body:default}}C default{{/slot:body:default}}</x>',
      }),
    );
    expect(out).toBe('<x>From A</x>');
  });

  it('falls back to the re-exposed default when the caller supplies no fill', async () => {
    const out = await renderBlocks(
      '{{#component:b}}{{/component:b}}',
      loaderFrom({
        b: '{{#component:c}}{{#slot:body}}{{#slot:heading:default}}B default{{/slot:heading:default}}{{/slot:body}}{{/component:c}}',
        c: '<x>{{#slot:body:default}}C default{{/slot:body:default}}</x>',
      }),
    );
    expect(out).toBe('<x>B default</x>');
  });

  it('blanks a re-exposed slot on an empty fill (holds position)', async () => {
    const out = await renderBlocks(
      '{{#component:b}}{{#slot:heading}}{{/slot:heading}}{{/component:b}}',
      loaderFrom({
        b: '{{#component:c}}{{#slot:body}}{{#slot:heading:default}}B default{{/slot:heading:default}}{{/slot:body}}{{/component:c}}',
        c: '<x>{{#slot:body:default}}C default{{/slot:body:default}}</x>',
      }),
    );
    expect(out).toBe('<x></x>');
  });

  it('throws a typed circular_ref on a persisted cycle instead of recursing forever', async () => {
    await expect(
      renderBlocks(
        '{{#component:a}}{{/component:a}}',
        loaderFrom({ a: '{{#component:b}}{{/component:b}}', b: '{{#component:a}}{{/component:a}}' }),
      ),
    ).rejects.toMatchObject({ type: 'circular_ref' });
  });

  it('does not false-positive a component nested inside its own override slot', async () => {
    const out = await renderBlocks(
      '{{#component:card}}{{#slot:body}}{{#component:card}}{{/component:card}}{{/slot:body}}{{/component:card}}',
      loaderFrom({ card: '<x>{{#slot:body:default}}D{{/slot:body:default}}</x>' }),
    );
    expect(out).toBe('<x><x>D</x></x>');
  });
});
