import { describe, expect, it } from 'bun:test';
import { type ComponentNode, parseBlocks, type SlotNode } from '@template/email/render/parseBlocks';

describe('parseBlocks', () => {
  it('returns a single text node for plain content', () => {
    expect(parseBlocks('<mj-text>Hello</mj-text>')).toEqual([{ type: 'text', value: '<mj-text>Hello</mj-text>' }]);
  });

  it('leaves interpolation and conditionals as opaque text', () => {
    const input = '{{recipient.name}} {{#if rule=x}}hi{{/if}}';
    expect(parseBlocks(input)).toEqual([{ type: 'text', value: input }]);
  });

  it('parses a bare component ref with no children', () => {
    expect(parseBlocks('{{#component:card}}{{/component:card}}')).toEqual([
      { type: 'component', slug: 'card', children: [] },
    ]);
  });

  it('parses a caller override slot as a non-default slot inside the ref', () => {
    const nodes = parseBlocks('{{#component:card}}{{#slot:body}}<mj-text>Hi</mj-text>{{/slot:body}}{{/component:card}}');

    expect(nodes).toEqual([
      {
        type: 'component',
        slug: 'card',
        children: [{ type: 'slot', name: 'body', isDefault: false, children: [{ type: 'text', value: '<mj-text>Hi</mj-text>' }] }],
      },
    ]);
  });

  it('parses a component default slot as a default slot', () => {
    const nodes = parseBlocks(
      '{{#component:card}}{{#slot:body:default}}<mj-text>Default</mj-text>{{/slot:body:default}}{{/component:card}}',
    );
    const slot = (nodes[0] as ComponentNode).children[0] as SlotNode;

    expect(slot).toEqual({
      type: 'slot',
      name: 'body',
      isDefault: true,
      children: [{ type: 'text', value: '<mj-text>Default</mj-text>' }],
    });
  });

  it('keeps sibling components at the same level', () => {
    const nodes = parseBlocks('{{#component:header}}{{/component:header}}{{#component:footer}}{{/component:footer}}');
    expect(nodes.map((n) => (n as ComponentNode).slug)).toEqual(['header', 'footer']);
  });

  it('parses a component nested inside a slot default (nesting regression shape)', () => {
    const input =
      '{{#component:hero}}{{#slot:body:default}}{{#component:cta}}{{#slot:label}}Get started{{/slot:label}}{{/component:cta}}{{/slot:body:default}}{{/component:hero}}';

    const hero = parseBlocks(input)[0] as ComponentNode;
    expect(hero.slug).toBe('hero');

    const body = hero.children[0] as SlotNode;
    expect(body).toMatchObject({ type: 'slot', name: 'body', isDefault: true });

    const cta = body.children[0] as ComponentNode;
    expect(cta).toMatchObject({ type: 'component', slug: 'cta' });

    const label = cta.children[0] as SlotNode;
    expect(label).toMatchObject({ type: 'slot', name: 'label', isDefault: false });
    expect(label.children).toEqual([{ type: 'text', value: 'Get started' }]);
  });

  it('handles the same slug nested inside itself', () => {
    const input = '{{#component:box}}{{#slot:inner}}{{#component:box}}{{/component:box}}{{/slot:inner}}{{/component:box}}';

    const outer = parseBlocks(input)[0] as ComponentNode;
    const slot = outer.children[0] as SlotNode;
    const inner = slot.children[0] as ComponentNode;

    expect(outer.slug).toBe('box');
    expect(inner).toEqual({ type: 'component', slug: 'box', children: [] });
  });

  it('preserves text interleaved with blocks', () => {
    const nodes = parseBlocks('before{{#component:card}}{{/component:card}}after');
    expect(nodes).toEqual([
      { type: 'text', value: 'before' },
      { type: 'component', slug: 'card', children: [] },
      { type: 'text', value: 'after' },
    ]);
  });
});
