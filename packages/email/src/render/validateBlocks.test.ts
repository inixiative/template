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
