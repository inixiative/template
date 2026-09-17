import { describe, expect, it } from 'bun:test';
import { ParseBlocksError, type ParseBlocksErrorReason } from '@template/email/errors/ParseBlocksError';
import { componentTagPattern, SLUG_PATTERN } from '@template/email/render/blockTags';
import { type ComponentNode, isOverrideSlot, type SlotNode } from '@template/email/render/nodes';
import { parseBlocks } from '@template/email/render/parseBlocks';
import { assertNoDuplicateExposedSlots } from '@template/email/validations/assertNoDuplicateExposedSlots';

const reasonOf = (fn: () => void): ParseBlocksErrorReason | string | undefined => {
  try {
    fn();
  } catch (error) {
    return error instanceof ParseBlocksError ? error.reason : `not-a-ParseBlocksError:${String(error)}`;
  }
  return undefined;
};

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
    const nodes = parseBlocks(
      '{{#component:card}}{{#slot:body}}<mj-text>Hi</mj-text>{{/slot:body}}{{/component:card}}',
    );

    expect(nodes).toEqual([
      {
        type: 'component',
        slug: 'card',
        children: [
          {
            type: 'slot',
            name: 'body',
            isDefault: false,
            children: [{ type: 'text', value: '<mj-text>Hi</mj-text>' }],
          },
        ],
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
    const input =
      '{{#component:box}}{{#slot:inner}}{{#component:box}}{{/component:box}}{{/slot:inner}}{{/component:box}}';

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

  it('accepts a default slot and an override that share a name (default is not an override)', () => {
    expect(() =>
      parseBlocks(
        '{{#component:card}}{{#slot:body:default}}d{{/slot:body}}{{#slot:body}}o{{/slot:body}}{{/component:card}}',
      ),
    ).not.toThrow();
  });

  it('allows the same override slot name in two different refs', () => {
    expect(() =>
      parseBlocks(
        '{{#component:a}}{{#slot:body}}1{{/slot:body}}{{/component:a}}{{#component:b}}{{#slot:body}}2{{/slot:body}}{{/component:b}}',
      ),
    ).not.toThrow();
  });
});

describe('parseBlocks — hardening: tag balance (kind + name must match)', () => {
  it('throws on a close tag of the wrong KIND (component vs slot)', () => {
    expect(reasonOf(() => parseBlocks('{{#component:card}}{{/slot:card}}'))).toBe('mismatched_close');
  });

  it('throws on a close tag of the wrong NAME', () => {
    expect(reasonOf(() => parseBlocks('{{#component:card}}{{/component:other}}'))).toBe('mismatched_close');
  });

  it('throws on a stray close tag with no open at all', () => {
    expect(reasonOf(() => parseBlocks('hello{{/component:card}}world'))).toBe('stray_close');
  });

  it('throws on a close tag that pops past a still-open sibling (mismatched nesting)', () => {
    expect(reasonOf(() => parseBlocks('{{#component:outer}}{{#component:inner}}{{/component:outer}}'))).toBe(
      'mismatched_close',
    );
  });

  it('throws on an unclosed open at end of input', () => {
    expect(reasonOf(() => parseBlocks('{{#component:footer}}<mj-text>Footer</mj-text>'))).toBe('unclosed_open');
  });

  it('throws on an unclosed slot nested inside a properly-closed component', () => {
    expect(() => parseBlocks('{{#component:card}}{{#slot:body}}<mj-text>Hi</mj-text>{{/component:card}}')).toThrow(
      ParseBlocksError,
    );
  });
});

describe('parseBlocks — hardening: whitespace-spaced tags are rejected, not silently literal', () => {
  it('throws on a whitespace-spaced open tag (space after #)', () => {
    expect(() => parseBlocks('{{# component:card}}{{/component:card}}')).toThrow(ParseBlocksError);
  });

  it('throws on a whitespace-spaced open tag (space around the colon)', () => {
    expect(() => parseBlocks('{{#component : card}}{{/component:card}}')).toThrow(ParseBlocksError);
  });

  it('throws on a whitespace-spaced open tag (trailing space before close brace)', () => {
    expect(() => parseBlocks('{{#component:card }}{{/component:card}}')).toThrow(ParseBlocksError);
  });

  it('throws on a space between {{ and # (leading-space evasion)', () => {
    expect(reasonOf(() => parseBlocks('{{ #component:card}}{{/component:card}}'))).toBe('mismatched_close');
  });

  it('throws on a space between {{ and / on a close tag', () => {
    expect(() => parseBlocks('{{#component:card}}{{ /component:card}}')).toThrow(ParseBlocksError);
  });

  it('does not throw on a canonically-formed tag with no whitespace', () => {
    expect(() => parseBlocks('{{#component:card}}{{/component:card}}')).not.toThrow();
  });
});

describe('parseBlocks — hardening: slug alphabet ^[a-z0-9-]+$ enforced at parse', () => {
  it('classifies an uppercase component slug as invalid_slug', () => {
    expect(reasonOf(() => parseBlocks('{{#component:Card}}{{/component:Card}}'))).toBe('invalid_slug');
  });

  it('classifies an underscore slug as invalid_slug', () => {
    expect(reasonOf(() => parseBlocks('{{#component:card_1}}{{/component:card_1}}'))).toBe('invalid_slug');
  });

  it('throws on a slot name outside the alphabet', () => {
    expect(reasonOf(() => parseBlocks('{{#component:card}}{{#slot:Body}}x{{/slot:Body}}{{/component:card}}'))).toBe(
      'invalid_slug',
    );
  });

  it('accepts lowercase letters, digits, and hyphens', () => {
    expect(() => parseBlocks('{{#component:card-v2-final}}{{/component:card-v2-final}}')).not.toThrow();
  });

  it('exports the slug alphabet for other grammars to share', () => {
    expect(SLUG_PATTERN.test('card-v2')).toBe(true);
    expect(SLUG_PATTERN.test('Card')).toBe(false);
  });
});

describe('parseBlocks — hardening: :default modifier is slot-only', () => {
  it('rejects :default on a component open tag', () => {
    expect(reasonOf(() => parseBlocks('{{#component:card:default}}{{/component:card:default}}'))).toBe(
      'invalid_modifier',
    );
  });

  it('rejects :default on a component close tag', () => {
    expect(reasonOf(() => parseBlocks('{{#component:card}}{{/component:card:default}}'))).toBe('invalid_modifier');
  });

  it('still accepts :default on a slot', () => {
    expect(() =>
      parseBlocks('{{#component:card}}{{#slot:body:default}}x{{/slot:body:default}}{{/component:card}}'),
    ).not.toThrow();
  });
});

describe('parseBlocks — hardening: duplicate override slots on one ref are rejected (silent last-wins)', () => {
  it('throws when the same override slot name fills a ref twice', () => {
    expect(
      reasonOf(() =>
        parseBlocks('{{#component:card}}{{#slot:body}}A{{/slot:body}}{{#slot:body}}B{{/slot:body}}{{/component:card}}'),
      ),
    ).toBe('duplicate_slot');
  });

  it('allows two DIFFERENT override slot names on one ref', () => {
    expect(() =>
      parseBlocks(
        '{{#component:card}}{{#slot:header}}H{{/slot:header}}{{#slot:footer}}F{{/slot:footer}}{{/component:card}}',
      ),
    ).not.toThrow();
  });

  it('lets an unclosed ref outrank a duplicate slot inside it', () => {
    expect(
      reasonOf(() =>
        parseBlocks('{{#component:card}}{{#slot:foo}}{{/slot:foo}}{{#slot:foo}}{{/slot:foo}}{{#slot:bar}}'),
      ),
    ).toBe('unclosed_open');
  });

  it('lets a mismatched close outrank a duplicate slot inside the same ref', () => {
    expect(
      reasonOf(() => parseBlocks('{{#component:card}}{{#slot:foo}}{{/slot:foo}}{{#slot:foo}}{{/slot:foo}}{{/slot:x}}')),
    ).toBe('mismatched_close');
  });
});

describe('assertNoDuplicateExposedSlots', () => {
  const check = (src: string, slug?: string) => () => assertNoDuplicateExposedSlots(parseBlocks(src), slug);

  it('accepts a body exposing distinct slot names', () => {
    expect(
      check('{{#slot:heading:default}}h{{/slot:heading:default}}{{#slot:body:default}}b{{/slot:body:default}}'),
    ).not.toThrow();
  });

  it('rejects two same-name default slots in one body', () => {
    expect(
      reasonOf(
        check(
          '{{#slot:heading:default}}one{{/slot:heading:default}}{{#slot:heading:default}}two{{/slot:heading:default}}',
          'b',
        ),
      ),
    ).toBe('duplicate_slot');
  });

  it('names the component in the error when a slug is given', () => {
    expect(
      check(
        '{{#slot:heading:default}}one{{/slot:heading:default}}{{#slot:heading:default}}two{{/slot:heading:default}}',
        'b',
      ),
    ).toThrow('component "b"');
  });

  it('rejects a re-exposed slot colliding with a top-level default of the same name', () => {
    const src =
      '{{#slot:heading:default}}own{{/slot:heading:default}}' +
      '{{#component:c}}{{#slot:body}}{{#slot:heading:default}}re-exposed{{/slot:heading:default}}{{/slot:body}}{{/component:c}}';
    expect(reasonOf(check(src))).toBe('duplicate_slot');
  });

  it('lets a fill for a child slot share a name with the body own slot (different namespaces)', () => {
    const src =
      '{{#slot:body:default}}own{{/slot:body:default}}' +
      '{{#component:c}}{{#slot:body}}fill for c{{/slot:body}}{{/component:c}}';
    expect(check(src)).not.toThrow();
  });

  it('treats a same-name slot nested inside its own default as shadowed, not duplicated', () => {
    const src =
      '{{#slot:x:default}}{{#component:c}}{{#slot:body}}{{#slot:x:default}}inner{{/slot:x:default}}{{/slot:body}}{{/component:c}}{{/slot:x:default}}';
    expect(check(src)).not.toThrow();
  });

  it('rejects the same name re-exposed under two different enclosing defaults', () => {
    const src =
      '{{#slot:left:default}}{{#slot:x:default}}1{{/slot:x:default}}{{/slot:left:default}}' +
      '{{#slot:right:default}}{{#slot:x:default}}2{{/slot:x:default}}{{/slot:right:default}}';
    expect(reasonOf(check(src))).toBe('duplicate_slot');
  });

  it('rejects two refs to the same component re-exposing one name under different override slots', () => {
    const src =
      '{{#component:c}}{{#slot:left}}{{#slot:x:default}}1{{/slot:x:default}}{{/slot:left}}{{/component:c}}' +
      '{{#component:c}}{{#slot:right}}{{#slot:x:default}}2{{/slot:x:default}}{{/slot:right}}{{/component:c}}';
    expect(reasonOf(check(src))).toBe('duplicate_slot');
  });

  it('does not let shadowing swallow a real duplicate elsewhere in the body', () => {
    const src =
      '{{#slot:x:default}}{{#component:c}}{{#slot:body}}{{#slot:x:default}}1{{/slot:x:default}}{{/slot:body}}{{/component:c}}{{/slot:x:default}}' +
      '{{#slot:x:default}}sibling{{/slot:x:default}}';
    expect(reasonOf(check(src))).toBe('duplicate_slot');
  });

  it('ignores slots that only live inside a referenced component body (not this body)', () => {
    const src =
      '{{#slot:x:default}}a{{/slot:x:default}}' +
      '{{#component:c}}{{#slot:x:default}}body-owned{{/slot:x:default}}{{/component:c}}';
    expect(check(src)).not.toThrow();
  });
});

describe('parseBlocks exports', () => {
  it('componentTagPattern returns a fresh global regex matching canonical tags', () => {
    const first = componentTagPattern();
    const second = componentTagPattern();
    expect(first).not.toBe(second);
    expect(first.global).toBe(true);
    expect([
      ...'{{#component:card}}{{#slot:body:default}}{{/slot:body:default}}{{/component:card}}'.matchAll(first),
    ]).toHaveLength(4);
  });

  it('isOverrideSlot picks out non-default slots only', () => {
    const [card] = parseBlocks(
      '{{#component:card}}{{#slot:a}}1{{/slot:a}}{{#slot:b:default}}2{{/slot:b:default}}x{{/component:card}}',
    ) as ComponentNode[];
    expect(card.children.filter(isOverrideSlot).map((s) => s.name)).toEqual(['a']);
  });
});
