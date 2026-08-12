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
});
