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

describe('validateConditions — {{#each}} blocks', () => {
  it('returns no issues for a valid loop over a reserved root', () => {
    expect(validateConditions('{{#each data.items as=item index=i}}{{item.name}}{{/each}}')).toEqual([]);
  });

  it('returns no issues for a nested loop rooted at the enclosing as=', () => {
    const tpl = '{{#each data.brands as=brand}}{{#each brand.missions as=mission}}{{mission.name}}{{/each}}{{/each}}';
    expect(validateConditions(tpl)).toEqual([]);
  });

  it('flags a missing as= attribute', () => {
    const issues = validateConditions('{{#each data.items}}x{{/each}}');
    expect(issues.some((x) => x.message.includes('missing as='))).toBe(true);
  });

  it('flags an as= that collides with a reserved word', () => {
    const issues = validateConditions('{{#each data.items as=data}}x{{/each}}');
    expect(issues.some((x) => x.message.includes('collides with a reserved word'))).toBe(true);
  });

  it('flags an as= that collides with an enclosing binding', () => {
    const tpl = '{{#each data.items as=item}}{{#each item.kids as=item}}x{{/each}}{{/each}}';
    expect(validateConditions(tpl).some((x) => x.message.includes('collides with an enclosing'))).toBe(true);
  });

  it('flags an index= that collides with this block own as=', () => {
    const issues = validateConditions('{{#each data.items as=item index=item}}x{{/each}}');
    expect(issues.some((x) => x.message.includes("collides with this block's own as="))).toBe(true);
  });

  it('flags an each-path root that is neither a reserved root nor an enclosing binding', () => {
    const issues = validateConditions('{{#each stuff.items as=item}}x{{/each}}');
    expect(issues.some((x) => x.message.includes('must be a reserved root'))).toBe(true);
  });

  it('flags an unterminated {{#each}} block', () => {
    const issues = validateConditions('{{#each data.items as=item}}x');
    expect(issues.some((x) => x.message.includes('unterminated {{#each}}'))).toBe(true);
  });

  it('flags invalid filter JSON', () => {
    const issues = validateConditions('{{#each data.items as=item filter={not json}}}x{{/each}}');
    expect(issues.some((x) => x.message.includes('invalid filter JSON'))).toBe(true);
  });

  it('flags a structurally invalid filter rule', () => {
    const bad = rule({ field: 'item.active' }); // missing operator
    const issues = validateConditions(`{{#each data.items as=item filter=${bad}}}x{{/each}}`);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('validates {{#if}} rules against the loop element scope', () => {
    const bad = rule({ field: 'item.vip' }); // missing operator
    const issues = validateConditions(`{{#each data.items as=item}}{{#if rule=${bad}}}x{{/if}}{{/each}}`);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('bans {{#each}} in a subject line but still allows conditionals', () => {
    expect(
      validateConditions('{{#each data.items as=item}}x{{/each}}', { isSubject: true }).some((x) =>
        x.message.includes('not allowed in the subject line'),
      ),
    ).toBe(true);
    const ok = rule({ field: 'recipient.tier', operator: 'equals', value: 'gold' });
    expect(validateConditions(`{{#if rule=${ok}}}A{{/if}}`, { isSubject: true })).toEqual([]);
  });
});
