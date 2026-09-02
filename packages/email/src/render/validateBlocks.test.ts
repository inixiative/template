import { describe, expect, it } from 'bun:test';
import { BlockValidationError, validateBlocks } from '@template/email/render/validateBlocks';

const reasonOf = (fn: () => void): string | undefined => {
  try {
    fn();
  } catch (error) {
    return error instanceof BlockValidationError ? error.reason : `not-a-BlockValidationError:${String(error)}`;
  }
  return undefined;
};

describe('validateBlocks', () => {
  it('accepts a bare component ref', () => {
    expect(() => validateBlocks('{{#component:card}}{{/component:card}}')).not.toThrow();
  });

  it('accepts a ref with an override slot', () => {
    expect(() => validateBlocks('{{#component:card}}{{#slot:body}}hi{{/slot:body}}{{/component:card}}')).not.toThrow();
  });

  it('accepts a ref carrying a default slot and an override of a different name', () => {
    expect(() =>
      validateBlocks(
        '{{#component:card}}{{#slot:head:default}}d{{/slot:head}}{{#slot:body}}o{{/slot:body}}{{/component:card}}',
      ),
    ).not.toThrow();
  });

  it('accepts a default slot and an override that share a name (default is not an override)', () => {
    expect(() =>
      validateBlocks(
        '{{#component:card}}{{#slot:body:default}}d{{/slot:body}}{{#slot:body}}o{{/slot:body}}{{/component:card}}',
      ),
    ).not.toThrow();
  });

  it('accepts nested component refs', () => {
    expect(() =>
      validateBlocks(
        '{{#component:outer}}{{#slot:s}}{{#component:inner}}{{/component:inner}}{{/slot:s}}{{/component:outer}}',
      ),
    ).not.toThrow();
  });

  it('accepts text with no block tags', () => {
    expect(() => validateBlocks('<mj-text>{{recipient.name}}</mj-text>')).not.toThrow();
  });

  it('rejects a stray close tag', () => {
    expect(reasonOf(() => validateBlocks('{{/component:card}}'))).toBe('stray_close');
  });

  it('rejects a kind-mismatched close', () => {
    expect(reasonOf(() => validateBlocks('{{#component:card}}{{/slot:card}}'))).toBe('mismatched_close');
  });

  it('rejects a name-mismatched close', () => {
    expect(reasonOf(() => validateBlocks('{{#component:card}}{{/component:box}}'))).toBe('mismatched_close');
  });

  it('rejects an unclosed open at end of input', () => {
    expect(reasonOf(() => validateBlocks('{{#component:card}}body'))).toBe('unclosed_open');
  });

  it('rejects the :default modifier on a component tag', () => {
    expect(reasonOf(() => validateBlocks('{{#component:card:default}}{{/component:card}}'))).toBe('invalid_modifier');
  });

  it('rejects a duplicate override slot in one ref', () => {
    expect(
      reasonOf(() =>
        validateBlocks(
          '{{#component:card}}{{#slot:body}}1{{/slot:body}}{{#slot:body}}2{{/slot:body}}{{/component:card}}',
        ),
      ),
    ).toBe('duplicate_slot');
  });

  it('lets an unclosed ref outrank a duplicate slot inside it (reason precedence matches Zealot)', () => {
    expect(
      reasonOf(() =>
        validateBlocks('{{#component:card}}{{#slot:foo}}{{/slot:foo}}{{#slot:foo}}{{/slot:foo}}{{#slot:bar}}'),
      ),
    ).toBe('unclosed_open');
  });

  it('lets a mismatched close outrank a duplicate slot inside the same ref', () => {
    expect(
      reasonOf(() =>
        validateBlocks('{{#component:card}}{{#slot:foo}}{{/slot:foo}}{{#slot:foo}}{{/slot:foo}}{{/slot:x}}'),
      ),
    ).toBe('mismatched_close');
  });

  it('allows the same override slot name in two different refs', () => {
    expect(() =>
      validateBlocks(
        '{{#component:a}}{{#slot:body}}1{{/slot:body}}{{/component:a}}{{#component:b}}{{#slot:body}}2{{/slot:body}}{{/component:b}}',
      ),
    ).not.toThrow();
  });

  it('rejects an out-of-alphabet slug (uppercase) as invalid_slug', () => {
    expect(reasonOf(() => validateBlocks('{{#component:Card}}{{/component:Card}}'))).toBe('invalid_slug');
  });

  it('rejects a whitespace-spaced tag rather than treating it as text', () => {
    expect(reasonOf(() => validateBlocks('{{ #component:card}}{{/component:card}}'))).toBe('mismatched_close');
  });
});

describe('validateBlocks — duplicate exposed slot names in one component body', () => {
  it('rejects two same-name default slots in one component body', () => {
    expect(
      reasonOf(() =>
        validateBlocks(
          '{{#component:b}}{{#slot:heading:default}}one{{/slot:heading}}{{#slot:heading:default}}two{{/slot:heading}}{{/component:b}}',
        ),
      ),
    ).toBe('duplicate_slot');
  });

  it('rejects a re-exposed slot colliding with a same-name default in the same body', () => {
    expect(
      reasonOf(() =>
        validateBlocks(
          '{{#component:b}}{{#slot:heading:default}}own{{/slot:heading}}{{#component:c}}{{#slot:body}}{{#slot:heading:default}}re-exposed{{/slot:heading}}{{/slot:body}}{{/component:c}}{{/component:b}}',
        ),
      ),
    ).toBe('duplicate_slot');
  });

  it('rejects a duplicate exposed name in a raw component body (direct component save shape)', () => {
    expect(
      reasonOf(() =>
        validateBlocks(
          '{{#slot:heading:default}}own{{/slot:heading}}{{#component:c}}{{#slot:body}}{{#slot:heading:default}}re-exposed{{/slot:heading}}{{/slot:body}}{{/component:c}}',
        ),
      ),
    ).toBe('duplicate_slot');
  });

  it('allows a same-name slot nested inside another slot default (shadowed, not duplicated)', () => {
    expect(() =>
      validateBlocks(
        '{{#component:b}}{{#slot:heading:default}}outer {{#slot:heading:default}}inner{{/slot:heading}}{{/slot:heading}}{{/component:b}}',
      ),
    ).not.toThrow();
  });

  it('rejects same-name slots reachable through two different unfilled defaults', () => {
    expect(
      reasonOf(() =>
        validateBlocks(
          '{{#component:b}}{{#slot:left:default}}{{#slot:x:default}}1{{/slot:x}}{{/slot:left}}{{#slot:right:default}}{{#slot:x:default}}2{{/slot:x}}{{/slot:right}}{{/component:b}}',
        ),
      ),
    ).toBe('duplicate_slot');
  });

  it('rejects two refs to the same component re-exposing one name under different override slots', () => {
    expect(
      reasonOf(() =>
        validateBlocks(
          '{{#component:c}}{{#slot:left}}{{#slot:x:default}}1{{/slot:x}}{{/slot:left}}{{/component:c}}' +
            '{{#component:c}}{{#slot:right}}{{#slot:x:default}}2{{/slot:x}}{{/slot:right}}{{/component:c}}',
        ),
      ),
    ).toBe('duplicate_slot');
  });

  it('rejects re-exposures reachable through two different enclosing defaults', () => {
    expect(
      reasonOf(() =>
        validateBlocks(
          '{{#slot:a:default}}{{#component:c}}{{#slot:body}}{{#slot:x:default}}1{{/slot:x}}{{/slot:body}}{{/component:c}}{{/slot:a}}' +
            '{{#slot:b:default}}{{#component:c}}{{#slot:body}}{{#slot:x:default}}2{{/slot:x}}{{/slot:body}}{{/component:c}}{{/slot:b}}',
        ),
      ),
    ).toBe('duplicate_slot');
  });

  it('does not let shadowing swallow a real duplicate elsewhere in the body', () => {
    expect(
      reasonOf(() =>
        validateBlocks(
          '{{#slot:x:default}}{{#component:c}}{{#slot:body}}{{#slot:x:default}}1{{/slot:x}}{{/slot:body}}{{/component:c}}{{/slot:x}}' +
            '{{#slot:x:default}}sibling{{/slot:x}}',
        ),
      ),
    ).toBe('duplicate_slot');
  });

  it('allows a fill for a child to share a name with the enclosing component own slot', () => {
    expect(() =>
      validateBlocks(
        '{{#component:b}}{{#slot:body:default}}own{{/slot:body}}{{#component:c}}{{#slot:body}}fill{{/slot:body}}{{/component:c}}{{/component:b}}',
      ),
    ).not.toThrow();
  });

  it('allows the same exposed name in two different components', () => {
    expect(() =>
      validateBlocks(
        '{{#component:a}}{{#slot:body:default}}1{{/slot:body}}{{/component:a}}{{#component:b}}{{#slot:body:default}}2{{/slot:body}}{{/component:b}}',
      ),
    ).not.toThrow();
  });

  it('allows one component referenced twice with different fills', () => {
    expect(() =>
      validateBlocks(
        '{{#component:card}}{{#slot:body}}first{{/slot:body}}{{/component:card}}{{#component:card}}{{#slot:body}}second{{/slot:body}}{{/component:card}}',
      ),
    ).not.toThrow();
  });
});
