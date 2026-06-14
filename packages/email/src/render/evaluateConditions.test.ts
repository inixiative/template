import { describe, expect, it } from 'bun:test';
import { evaluateConditions } from '@template/email/render/evaluateConditions';

const rule = (field: string, operator: string, value: unknown) => JSON.stringify({ field, operator, value });

describe('evaluateConditions — else / else if', () => {
  const tiered = `{{#if rule=${rule('recipient.tier', 'equals', 'gold')}}}G{{else if rule=${rule('recipient.tier', 'equals', 'silver')}}}S{{else}}B{{/if}}`;

  it('renders the if branch when its rule is true (else ignored)', () => {
    expect(evaluateConditions(tiered, { recipient: { tier: 'gold' } })).toBe('G');
  });

  it('renders the else branch when the if rule is false', () => {
    const tpl = `{{#if rule=${rule('recipient.tier', 'equals', 'gold')}}}G{{else}}OTHER{{/if}}`;
    expect(evaluateConditions(tpl, { recipient: { tier: 'silver' } })).toBe('OTHER');
  });

  it('picks the first matching else-if branch', () => {
    expect(evaluateConditions(tiered, { recipient: { tier: 'silver' } })).toBe('S');
  });

  it('falls through to else when no branch matches', () => {
    expect(evaluateConditions(tiered, { recipient: { tier: 'bronze' } })).toBe('B');
  });

  it('renders nothing when no branch matches and there is no else', () => {
    const tpl = `{{#if rule=${rule('recipient.tier', 'equals', 'gold')}}}G{{else if rule=${rule('recipient.tier', 'equals', 'silver')}}}S{{/if}}`;
    expect(evaluateConditions(tpl, { recipient: { tier: 'bronze' } })).toBe('');
  });
});

describe('evaluateConditions — nesting', () => {
  const outer = rule('recipient.tier', 'equals', 'gold');
  const inner = rule('recipient.vip', 'equals', true);

  it('evaluates a nested if inside a matched branch', () => {
    const tpl = `{{#if rule=${outer}}}G[{{#if rule=${inner}}}VIP{{/if}}]{{else}}X{{/if}}`;
    expect(evaluateConditions(tpl, { recipient: { tier: 'gold', vip: true } })).toBe('G[VIP]');
    expect(evaluateConditions(tpl, { recipient: { tier: 'gold', vip: false } })).toBe('G[]');
    expect(evaluateConditions(tpl, { recipient: { tier: 'silver', vip: true } })).toBe('X');
  });

  it("a nested block's else/else-if does not leak into the outer block", () => {
    const tpl = `{{#if rule=${outer}}}A{{#if rule=${inner}}}B{{else}}C{{/if}}D{{else}}E{{/if}}`;
    expect(evaluateConditions(tpl, { recipient: { tier: 'gold', vip: true } })).toBe('ABD');
    expect(evaluateConditions(tpl, { recipient: { tier: 'gold', vip: false } })).toBe('ACD');
    expect(evaluateConditions(tpl, { recipient: { tier: 'silver', vip: true } })).toBe('E');
  });
});

describe('evaluateConditions — regression', () => {
  it('handles multiple sequential conditionals', () => {
    const tpl = `{{#if rule=${rule('recipient.role', 'equals', 'admin')}}}[A]{{/if}}{{#if rule=${rule('recipient.premium', 'equals', true)}}}[P]{{/if}} U`;
    expect(evaluateConditions(tpl, { recipient: { role: 'admin', premium: false } })).toBe('[A] U');
  });

  it('passes content through unchanged when there are no conditionals', () => {
    expect(evaluateConditions('Hello {{recipient.name}}', { recipient: { name: 'x' } })).toBe(
      'Hello {{recipient.name}}',
    );
  });
});
