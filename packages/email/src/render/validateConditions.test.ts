import { describe, expect, it } from 'bun:test';
import { createLens, type Lens } from '@inixiative/json-rules';
import { EACH_MAX_DEPTH } from '@template/email/render/limits';
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

const testLens: Lens = createLens({
  mapName: 'test',
  model: 'Root',
  maps: {
    test: {
      models: {
        Root: {
          fields: {
            recipient: { kind: 'object', type: 'Recipient' },
            sender: { kind: 'object', type: 'Sender' },
            system: { kind: 'object', type: 'System' },
          },
        },
        Recipient: {
          fields: {
            tier: { kind: 'scalar', type: 'String' },
            plan: { kind: 'scalar', type: 'String' },
            memberships: { kind: 'object', type: 'Membership', isList: true },
          },
        },
        Sender: {
          fields: { name: { kind: 'scalar', type: 'String' } },
        },
        System: {
          fields: { unsubscribeUrl: { kind: 'scalar', type: 'String' } },
        },
        Membership: {
          fields: {
            tier: { kind: 'scalar', type: 'String' },
            perks: { kind: 'object', type: 'Perk', isList: true },
          },
        },
        Perk: {
          fields: { status: { kind: 'scalar', type: 'String' } },
        },
      },
    },
  },
});

describe('validateConditions — whitespace-tolerant markers', () => {
  it('allows whitespace after rule= and before the closing }}', () => {
    expect(
      validateConditions(
        '{{#if rule= {"field":"recipient.plan","operator":"equals","value":"pro"} }}pro{{else}}free{{/if}}',
      ),
    ).toEqual([]);
  });
});

describe('validateConditions — lens validation of reserved-rooted rules', () => {
  it('an absolute-rooted {{#if}} rule validates against the lens', () => {
    expect(
      validateConditions('{{#if rule={"field":"recipient.tier","operator":"equals","value":"gold"}}}A{{/if}}', {
        lens: testLens,
      }),
    ).toEqual([]);
    expect(
      validateConditions('{{#if rule={"field":"recipient.notAField","operator":"equals","value":"x"}}}A{{/if}}', {
        lens: testLens,
      }).length,
    ).toBeGreaterThan(0);
  });

  it('a system-rooted rule validates against the lens like any other reserved root', () => {
    expect(
      validateConditions('{{#if rule={"field":"system.unsubscribeUrl","operator":"notEmpty"}}}A{{/if}}', {
        lens: testLens,
      }),
    ).toEqual([]);
  });

  it('an absolute-rooted filter validates against the lens, same as an {{#if}} rule', () => {
    expect(
      validateConditions(
        '{{#each recipient.memberships as=m filter={"field":"recipient.tier","operator":"equals","value":"gold"}}}X{{/each}}',
        { lens: testLens },
      ),
    ).toEqual([]);

    const badIssues = validateConditions(
      '{{#each recipient.memberships as=m filter={"field":"recipient.notAField","operator":"equals","value":"x"}}}X{{/each}}',
      { lens: testLens },
    );
    expect(badIssues.length).toBeGreaterThan(0);
  });

  it('attribute order does not affect validity under a lens', () => {
    const filterJson = '{"field":"m.tier","operator":"equals","value":"gold"}';
    const orderings = [
      `{{#each recipient.memberships as=m index=i filter=${filterJson}}}X{{/each}}`,
      `{{#each recipient.memberships filter=${filterJson} as=m index=i}}X{{/each}}`,
      `{{#each recipient.memberships index=i as=m filter=${filterJson}}}X{{/each}}`,
    ];
    for (const content of orderings) expect(validateConditions(content, { lens: testLens })).toEqual([]);
  });
});

describe('validateConditions — unknown binding roots', () => {
  it('a binding-rooted filter is checked for scope membership', () => {
    expect(
      validateConditions(
        '{{#each recipient.memberships as=m filter={"field":"m.tier","operator":"equals","value":"gold"}}}X{{/each}}',
        { lens: testLens },
      ),
    ).toEqual([]);

    const badIssues = validateConditions(
      '{{#each recipient.memberships as=m filter={"field":"nope.tier","operator":"equals","value":"gold"}}}X{{/each}}',
      { lens: testLens },
    );
    expect(badIssues.some((x) => x.message.includes('unknown binding'))).toBe(true);
  });

  it('an if-rule inside an each referencing the loop binding validates cleanly', () => {
    expect(
      validateConditions(
        '{{#each recipient.memberships as=m}}{{#if rule={"field":"m.tier","operator":"equals","value":"gold"}}}Y{{/if}}{{/each}}',
        { lens: testLens },
      ),
    ).toEqual([]);
  });

  it('an if-rule referencing an unbound identifier as its field root is an issue', () => {
    const issues = validateConditions(
      '{{#each recipient.memberships as=m}}{{#if rule={"field":"nope.tier","operator":"equals","value":"gold"}}}Y{{/if}}{{/each}}',
      { lens: testLens },
    );
    expect(issues.some((x) => x.message.includes('unknown binding'))).toBe(true);
  });

  it('reports the unknown binding without a lens too', () => {
    const issues = validateConditions(
      '{{#each data.items as=item}}{{#if rule={"field":"nope.x","operator":"equals","value":1}}}Y{{/if}}{{/each}}',
    );
    expect(issues.some((x) => x.message.includes('unknown binding "nope"'))).toBe(true);
  });

  it('walks each leaf independently — one valid binding does not suppress a sibling', () => {
    const issues = validateConditions(
      '{{#each recipient.memberships as=m filter={"all":[{"field":"m.tier","operator":"equals","value":"gold"},{"field":"recipient.notAField","operator":"equals","value":"x"}]}}}X{{/each}}',
      { lens: testLens },
    );

    expect(issues.some((x) => x.message.includes('path does not resolve through the narrowed lens'))).toBe(true);
    expect(issues.some((x) => x.message.includes('unknown binding'))).toBe(false);
  });

  it('a nested array element field under a binding-rooted leaf is relative, not a second binding root', () => {
    const issues = validateConditions(
      '{{#each recipient.memberships as=m filter={"field":"m.perks","arrayOperator":"any","condition":{"field":"status","operator":"equals","value":"active"}}}}X{{/each}}',
      { lens: testLens },
    );

    expect(issues).toEqual([]);
  });
});

describe('validateConditions — binding refs desugar to absolute paths for the lens', () => {
  it('a binding-rooted comparison `path` under a reserved-rooted `field` validates', () => {
    expect(
      validateConditions(
        '{{#each recipient.memberships as=m}}{{#if rule={"field":"recipient.tier","operator":"equals","path":"m.tier"}}}Y{{/if}}{{/each}}',
        { lens: testLens },
      ),
    ).toEqual([]);
  });

  it('the mirror image (binding-rooted field, reserved-rooted path) also validates', () => {
    expect(
      validateConditions(
        '{{#each recipient.memberships as=m}}{{#if rule={"field":"m.tier","operator":"equals","path":"recipient.tier"}}}Y{{/if}}{{/each}}',
        { lens: testLens },
      ),
    ).toEqual([]);
  });

  it('a binding-rooted field that typos an element field desugars and fails at save', () => {
    const issues = validateConditions(
      '{{#each recipient.memberships as=m}}{{#if rule={"field":"m.teir","operator":"equals","value":"gold"}}}Y{{/if}}{{/each}}',
      { lens: testLens },
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((x) => x.path.includes('recipient.memberships.teir'))).toBe(true);
  });

  it('desugars through two levels of nesting', () => {
    expect(
      validateConditions(
        '{{#each recipient.memberships as=m}}{{#each m.perks as=p}}{{#if rule={"field":"p.status","operator":"equals","value":"active"}}}Y{{/if}}{{/each}}{{/each}}',
        { lens: testLens },
      ),
    ).toEqual([]);
    expect(
      validateConditions(
        '{{#each recipient.memberships as=m}}{{#each m.perks as=p}}{{#if rule={"field":"p.bogus","operator":"equals","value":"active"}}}Y{{/if}}{{/each}}{{/each}}',
        { lens: testLens },
      ).length,
    ).toBeGreaterThan(0);
  });

  it('a field rooted at an index= counter skips the lens (no position) but stays in scope', () => {
    expect(
      validateConditions(
        '{{#each recipient.memberships as=m index=i}}{{#if rule={"field":"i","operator":"equals","value":0}}}Y{{/if}}{{/each}}',
        { lens: testLens },
      ),
    ).toEqual([]);
  });

  it('a literal {{/each}} inside an {{else if rule=…}} JSON string does not corrupt structural scanning', () => {
    expect(
      validateConditions(
        '{{#each recipient.memberships as=m}}{{#if rule={"field":"m.tier","operator":"equals","value":"a"}}}A{{else if rule={"field":"m.tier","operator":"equals","value":"{{/each}}"}}}B{{/if}}{{/each}}',
        { lens: testLens },
      ),
    ).toEqual([]);
  });

  it('a filter= whose JSON braces never close is a filter error, not an unterminated block', () => {
    const issues = validateConditions('{{#each recipient.memberships as=m filter={{{}}X{{/each}}', { lens: testLens });
    expect(issues.some((x) => x.message.includes('unterminated'))).toBe(false);
    expect(issues.some((x) => x.message.includes('filter JSON'))).toBe(true);
  });
});

describe('validateConditions — {{#each}} nesting depth cap', () => {
  const nest = (depth: number): string => {
    let inner = 'X';
    for (let level = depth; level >= 1; level--) {
      const path = level === 1 ? 'data.items' : `b${level - 1}.kids`;
      inner = `{{#each ${path} as=b${level}}}${inner}{{/each}}`;
    }
    return inner;
  };

  it(`accepts nesting exactly ${EACH_MAX_DEPTH} deep`, () => {
    expect(validateConditions(nest(EACH_MAX_DEPTH))).toEqual([]);
  });

  it(`rejects nesting one level deeper than ${EACH_MAX_DEPTH}`, () => {
    const depthIssues = validateConditions(nest(EACH_MAX_DEPTH + 1)).filter((x) =>
      x.message.includes('may not nest more than'),
    );

    expect(depthIssues).toHaveLength(1);
    expect(depthIssues[0]?.message).toBe(`{{#each}} blocks may not nest more than ${EACH_MAX_DEPTH} deep`);
  });

  it('reports the breach once even when nested far past the cap', () => {
    const issues = validateConditions(nest(EACH_MAX_DEPTH + 3));
    expect(issues.filter((x) => x.message.includes('may not nest more than'))).toHaveLength(1);
  });
});

describe('validateConditions — per-entity straddle check', () => {
  it('an each wrapping a bare component ref is fine (nothing to straddle)', () => {
    expect(validateConditions('{{#each data.items as=m}}{{#component:card}}{{/component:card}}{{/each}}')).toEqual([]);
  });

  it('an each wrapping a component ref WITH an override is fine (overrides are caller-owned)', () => {
    const content =
      '{{#each data.items as=m}}{{#component:card}}{{#slot:body}}text{{/slot:body}}{{/component:card}}{{/each}}';
    expect(validateConditions(content)).toEqual([]);
  });

  it('an each straddling an OVERRIDE boundary is still fine (an override always stays with the caller)', () => {
    const content =
      '{{#each data.items as=m}}{{#component:card}}{{#slot:body}}{{/each}}stray{{/slot:body}}{{/component:card}}';
    expect(validateConditions(content)).toEqual([]);
  });

  it("an each opening outside a ref and closing inside the ref's own bare body is a straddle", () => {
    const content = '{{#each data.items as=m}}{{#component:card}}{{/each}}stray{{/component:card}}';
    expect(validateConditions(content).some((x) => x.message.includes('straddle'))).toBe(true);
  });

  it('an each opening inside a `:default` slot and closing outside the whole ref is a straddle', () => {
    const content =
      '{{#component:card}}{{#slot:header:default}}{{#each data.items as=m}}{{/slot:header:default}}{{/component:card}}stray{{/each}}';
    expect(validateConditions(content).some((x) => x.message.includes('straddle'))).toBe(true);
  });

  it('an {{#if}} straddling a bare component body is a straddle too', () => {
    const content = '{{#if rule=true}}{{#component:card}}{{/if}}stray{{/component:card}}';
    expect(validateConditions(content).some((x) => x.message.includes('straddle'))).toBe(true);
  });
});
