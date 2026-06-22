import { describe, expect, it } from 'bun:test';
import {
  assertValidConditions,
  ConditionValidationError,
  validateConditions,
} from '@template/email/render/validateConditions';

const rule = (o: Record<string, unknown>) => JSON.stringify(o);

describe('validateConditions', () => {
  it('returns no issues for a valid if / else-if / else chain', () => {
    const tpl = `{{#if rule=${rule({ field: 'recipient.tier', operator: 'equals', value: 'gold' })}}}A{{else if rule=${rule(
      { field: 'recipient.tier', operator: 'in', value: ['silver', 'bronze'] },
    )}}}B{{else}}C{{/if}}`;
    expect(validateConditions(tpl)).toEqual([]);
  });

  it('flags invalid rule JSON', () => {
    const issues = validateConditions('{{#if rule={not json}}}A{{/if}}');
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('invalid rule JSON');
  });

  it('flags a structurally invalid rule (missing operator)', () => {
    const issues = validateConditions(`{{#if rule=${rule({ field: 'recipient.name' })}}}A{{/if}}`);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('flags an unterminated block', () => {
    const issues = validateConditions(`{{#if rule=${rule({ field: 'recipient.x', operator: 'equals', value: 1 })}}}A`);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('unterminated');
  });

  it('validates rules in nested and else-if branches', () => {
    const ok = rule({ field: 'recipient.tier', operator: 'equals', value: 'gold' });
    const bad = rule({ field: 'recipient.y' }); // missing operator
    const tpl = `{{#if rule=${ok}}}{{#if rule=${bad}}}x{{/if}}{{else if rule=${bad}}}y{{/if}}`;
    expect(validateConditions(tpl).length).toBeGreaterThanOrEqual(2);
  });

  it('assertValidConditions throws ConditionValidationError on invalid input', () => {
    expect(() => assertValidConditions('{{#if rule={bad}}}x{{/if}}')).toThrow(ConditionValidationError);
  });

  it('assertValidConditions passes for valid input', () => {
    const tpl = `{{#if rule=${rule({ field: 'recipient.tier', operator: 'equals', value: 'gold' })}}}A{{/if}}`;
    expect(() => assertValidConditions(tpl)).not.toThrow();
  });

  it('flags branches after {{else}} as unreachable dead code', () => {
    const r = rule({ field: 'recipient.tier', operator: 'equals', value: 'gold' });
    const r2 = rule({ field: 'recipient.tier', operator: 'equals', value: 'silver' });
    const issues = validateConditions(`{{#if rule=${r}}}A{{else}}B{{else if rule=${r2}}}C{{/if}}`);
    expect(issues.some((x) => x.message.includes('unreachable'))).toBe(true);
  });

  it('flags multiple {{else}} branches', () => {
    const r = rule({ field: 'recipient.tier', operator: 'equals', value: 'gold' });
    const issues = validateConditions(`{{#if rule=${r}}}A{{else}}B{{else}}C{{/if}}`);
    expect(issues.some((x) => x.message.includes('multiple {{else}}'))).toBe(true);
  });

  it('keeps validating blocks after an unterminated one', () => {
    const ok = rule({ field: 'recipient.tier', operator: 'equals', value: 'gold' });
    const bad = rule({ field: 'recipient.tier' }); // missing operator
    const issues = validateConditions(`{{#if rule=${ok}}}A   {{#if rule=${bad}}}B{{/if}}`);
    expect(issues.some((x) => x.message.includes('unterminated'))).toBe(true);
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});
