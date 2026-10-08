import { describe, expect, it } from 'bun:test';
import { evaluateConditions } from '@template/email/render/evaluateConditions';
import { defaultEmailLens } from '@template/email/rules/emailLens';

// why: rules are checked against the real lens at evaluation, so these use paths it admits — `data.*`
// why: is the free-form Json bucket; a made-up recipient column is a vocabulary violation, not a match.

const rule = (field: string, operator: string, value: unknown) =>
  JSON.stringify({ field, operator, value });

describe('evaluateConditions — else / else if', () => {
  const tiered = `{{#if rule=${rule('data.tier', 'equals', 'gold')}}}G{{else if rule=${rule('data.tier', 'equals', 'silver')}}}S{{else}}B{{/if}}`;

  it('renders the if branch when its rule is true (else ignored)', () => {
    expect(evaluateConditions(tiered, { data: { tier: 'gold' } }, defaultEmailLens)).toBe('G');
  });

  it('renders the else branch when the if rule is false', () => {
    const tpl = `{{#if rule=${rule('data.tier', 'equals', 'gold')}}}G{{else}}OTHER{{/if}}`;
    expect(evaluateConditions(tpl, { data: { tier: 'silver' } }, defaultEmailLens)).toBe('OTHER');
  });

  it('picks the first matching else-if branch', () => {
    expect(evaluateConditions(tiered, { data: { tier: 'silver' } }, defaultEmailLens)).toBe('S');
  });

  it('falls through to else when no branch matches', () => {
    expect(evaluateConditions(tiered, { data: { tier: 'bronze' } }, defaultEmailLens)).toBe('B');
  });

  it('renders nothing when no branch matches and there is no else', () => {
    const tpl = `{{#if rule=${rule('data.tier', 'equals', 'gold')}}}G{{else if rule=${rule('data.tier', 'equals', 'silver')}}}S{{/if}}`;
    expect(evaluateConditions(tpl, { data: { tier: 'bronze' } }, defaultEmailLens)).toBe('');
  });
});

describe('evaluateConditions — nesting', () => {
  const outer = rule('data.tier', 'equals', 'gold');
  const inner = rule('data.vip', 'equals', true);

  it('evaluates a nested if inside a matched branch', () => {
    const tpl = `{{#if rule=${outer}}}G[{{#if rule=${inner}}}VIP{{/if}}]{{else}}X{{/if}}`;
    expect(evaluateConditions(tpl, { data: { tier: 'gold', vip: true } }, defaultEmailLens)).toBe(
      'G[VIP]',
    );
    expect(evaluateConditions(tpl, { data: { tier: 'gold', vip: false } }, defaultEmailLens)).toBe(
      'G[]',
    );
    expect(evaluateConditions(tpl, { data: { tier: 'silver', vip: true } }, defaultEmailLens)).toBe(
      'X',
    );
  });

  it("a nested block's else/else-if does not leak into the outer block", () => {
    const tpl = `{{#if rule=${outer}}}A{{#if rule=${inner}}}B{{else}}C{{/if}}D{{else}}E{{/if}}`;
    expect(evaluateConditions(tpl, { data: { tier: 'gold', vip: true } }, defaultEmailLens)).toBe(
      'ABD',
    );
    expect(evaluateConditions(tpl, { data: { tier: 'gold', vip: false } }, defaultEmailLens)).toBe(
      'ACD',
    );
    expect(evaluateConditions(tpl, { data: { tier: 'silver', vip: true } }, defaultEmailLens)).toBe(
      'E',
    );
  });
});

describe('evaluateConditions — regression', () => {
  it('handles multiple sequential conditionals', () => {
    const tpl = `{{#if rule=${rule('data.role', 'equals', 'admin')}}}[A]{{/if}}{{#if rule=${rule('recipient.premium', 'equals', true)}}}[P]{{/if}} U`;
    expect(
      evaluateConditions(tpl, { data: { role: 'admin', premium: false } }, defaultEmailLens),
    ).toBe('[A] U');
  });

  it('passes content through unchanged when there are no conditionals', () => {
    expect(
      evaluateConditions(
        'Hello {{recipient.name}}',
        { recipient: { name: 'x' } },
        defaultEmailLens,
      ),
    ).toBe('Hello {{recipient.name}}');
  });
});

describe('evaluateConditions — render-error reporting', () => {
  const broken = '{{#if rule={bad json}}}A{{else}}B{{/if}}';

  it('reports a malformed rule via onError and skips the branch (degrades) by default', () => {
    const errors: string[] = [];
    const out = evaluateConditions(broken, {}, defaultEmailLens, (m) => errors.push(m.detail));
    expect(out).toBe('B');
    expect(errors).toHaveLength(1);
  });

  it('never calls onError when every rule is valid', () => {
    const errors: string[] = [];
    evaluateConditions('{{#if rule=true}}X{{else}}Y{{/if}}', {}, defaultEmailLens, (m) =>
      errors.push(m.detail),
    );
    expect(errors).toEqual([]);
  });
});

describe('evaluateConditions — non-object rules', () => {
  it('renders bare boolean rules (true/false are valid Conditions)', () => {
    expect(evaluateConditions('{{#if rule=true}}X{{/if}}', {}, defaultEmailLens)).toBe('X');
    expect(evaluateConditions('{{#if rule=false}}X{{else}}Y{{/if}}', {}, defaultEmailLens)).toBe(
      'Y',
    );
  });

  it('a boolean rule in a nested block does not corrupt the outer block', () => {
    const outer = rule('data.tier', 'equals', 'gold');
    const tpl = `{{#if rule=${outer}}}A{{#if rule=true}}B{{/if}}C{{else}}D{{/if}}`;
    expect(evaluateConditions(tpl, { data: { tier: 'gold' } }, defaultEmailLens)).toBe('ABC');
    expect(evaluateConditions(tpl, { data: { tier: 'x' } }, defaultEmailLens)).toBe('D');
  });
});

describe('evaluateConditions — reference liveness', () => {
  const tagged = JSON.stringify({
    field: 'recipient.tagAttachments',
    arrayOperator: 'any',
    condition: { field: 'tag.id', operator: 'equals', value: 'tag-1' },
  });
  const tpl = `{{#if rule=${tagged}}}VIP{{else}}BASE{{/if}}`;
  const vars = { recipient: { tagAttachments: [{ tag: { id: 'tag-1' } }] } };

  it('renders normally when the named row is in the live set', () => {
    expect(evaluateConditions(tpl, vars, defaultEmailLens, undefined, new Set(['Tag|tag-1']))).toBe(
      'VIP',
    );
  });

  it('a branch whose rule names a row outside the live set is a rule error, never a match', () => {
    const errors: string[] = [];
    expect(
      evaluateConditions(
        tpl,
        vars,
        defaultEmailLens,
        (message) => errors.push(message.detail),
        new Set(['Tag|tag-other']),
      ),
    ).toBe('BASE');
    expect(errors).toEqual(['rule names a Tag that no longer resolves: tag-1']);
  });

  it('fails closed on an empty live set — absence is the answer, not an unchecked pass', () => {
    const errors: string[] = [];
    expect(
      evaluateConditions(
        tpl,
        vars,
        defaultEmailLens,
        (message) => errors.push(message.detail),
        new Set(),
      ),
    ).toBe('BASE');
    expect(errors).toEqual(['rule names a Tag that no longer resolves: tag-1']);
  });

  it('an omitted live set means nothing was confirmed, so a rule naming a row is degraded', () => {
    const errors: string[] = [];
    expect(
      evaluateConditions(tpl, vars, defaultEmailLens, (message) => errors.push(message.detail)),
    ).toBe('BASE');
    expect(errors).toEqual(['rule names a Tag that no longer resolves: tag-1']);
  });
});

describe('evaluateConditions — bindings and unterminated rules', () => {
  it('a rule that reads its referenced row from path evaluates against the data it reads', () => {
    const rule = JSON.stringify({
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tag.id', operator: 'equals', path: 'recipient.id' },
    });
    const errors: string[] = [];
    const tpl = `{{#if rule=${rule}}}X{{else}}Y{{/if}}`;
    expect(
      evaluateConditions(
        tpl,
        { recipient: { id: 'u1', tagAttachments: [{ tag: { id: 'u1' } }] } },
        defaultEmailLens,
        (m) => errors.push(m.detail),
      ),
    ).toBe('X');
    expect(
      evaluateConditions(
        tpl,
        { recipient: { id: 'u1', tagAttachments: [] } },
        defaultEmailLens,
        (m) => errors.push(m.detail),
      ),
    ).toBe('Y');
    expect(errors).toHaveLength(0);
  });

  it('a rule that requires a binding nobody supplies is a rule error, never a match', () => {
    const rule = JSON.stringify({ field: 'recipient.name', operator: 'equals', bind: 'name' });
    const errors: string[] = [];
    const out = evaluateConditions(
      `{{#if rule=${rule}}}X{{else}}Y{{/if}}`,
      { recipient: { name: 'Ada' } },
      defaultEmailLens,
      (m) => errors.push(m.detail),
    );
    expect(out).toBe('Y');
    expect(errors).toEqual(['rule requires a binding that was not supplied: name']);
  });
});

describe('evaluateConditions — check() throwing at evaluation time', () => {
  const THROWING_RULE =
    '{{#if rule={"field":"recipient.plan","operator":"nope","value":"pro"}}}A{{else}}B{{/if}}';

  it('reports the thrown rule error via onError and skips the branch by default', () => {
    const errors: string[] = [];
    const output = evaluateConditions(
      THROWING_RULE,
      { recipient: { plan: 'pro' } },
      defaultEmailLens,
      (m) => errors.push(m.detail),
    );

    expect(output).toBe('B');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('recipient.plan');
  });

  it('skips the throwing branch and continues to a later else-if that matches', () => {
    const template =
      '{{#if rule={"field":"data.plan","operator":"nope","value":"pro"}}}A' +
      '{{else if rule={"field":"data.plan","operator":"equals","value":"pro"}}}C{{else}}B{{/if}}';

    expect(evaluateConditions(template, { data: { plan: 'pro' } }, defaultEmailLens)).toBe('C');
  });
});

describe('evaluateConditions — unterminated block', () => {
  it('renders nothing from an unterminated {{#if}} on and sinks the issue', () => {
    const errors: string[] = [];
    expect(
      evaluateConditions('before {{#if rule=true}}A', { recipient: {} }, defaultEmailLens, (m) =>
        errors.push(m.kind),
      ),
    ).toBe('before ');
    expect(errors).toEqual(['rule']);
  });

  it('renders content before an unterminated malformed block and stops at it', () => {
    expect(
      evaluateConditions('lead {{#if rule={"field":}}}tail', { recipient: {} }, defaultEmailLens),
    ).toBe('lead ');
  });
});

describe('evaluateConditions — undefined variable stripping', () => {
  it('drops undefined top-level variable groups from the rule data', () => {
    const output = evaluateConditions(
      '{{#if rule={"field":"recipient.name","operator":"exists"}}}has{{else}}none{{/if}}',
      { recipient: undefined, data: { x: 1 } },
      defaultEmailLens,
    );

    expect(output).toBe('none');
  });
});

describe('evaluateConditions — {{#each}} filter errors, the each-analog of the if-branch affordance', () => {
  const THROWING_FILTER =
    '{{#each data.items as=item filter={"field":"item.x","operator":"nope","value":1}}}{{item.n}}{{/each}}';

  it('a throwing filter check() sinks once and excludes every element by default', () => {
    const errors: string[] = [];
    const output = evaluateConditions(
      THROWING_FILTER,
      { data: { items: [{ x: 1 }, { x: 1 }] } },
      defaultEmailLens,
      (m) => errors.push(m.detail),
    );

    expect(output).toBe('');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Unknown operator');
  });

  it('malformed filter= JSON sinks and renders empty by default', () => {
    const errors: string[] = [];
    const output = evaluateConditions(
      '{{#each data.items as=item filter={bad json}}}X{{/each}}',
      { data: { items: [1] } },
      defaultEmailLens,
      (m) => errors.push(m.detail),
    );

    expect(output).toBe('');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('invalid filter JSON');
  });
});

describe('evaluateConditions — {{#each}} resolved structurally, never substituted', () => {
  it('iterates and filters, but leaves binding + reserved-root tokens inside the body unsubstituted', () => {
    expect(
      evaluateConditions(
        '{{#each data.items as=item}}[{{item}}]{{/each}}',
        {
          data: { items: ['a', 'b'] },
        },
        defaultEmailLens,
      ),
    ).toBe('[{{item}}][{{item}}]');
  });

  it('filter= still excludes elements structurally', () => {
    const result = evaluateConditions(
      '{{#each data.items as=item filter={"field":"item.ok","operator":"equals","value":true}}}X{{/each}}',
      { data: { items: [{ ok: false }, { ok: true }] } },
      defaultEmailLens,
    );

    expect(result).toBe('X');
  });

  it('an empty array still renders empty with no structural change', () => {
    expect(
      evaluateConditions(
        '{{#each data.items as=item}}X{{/each}}',
        { data: { items: [] } },
        defaultEmailLens,
      ),
    ).toBe('');
  });
});

describe('evaluateConditions — loop bindings are judged through the lens as absolute paths', () => {
  it('a rule on the loop element evaluates instead of degrading as out-of-vocabulary', () => {
    const errors: string[] = [];
    const out = evaluateConditions(
      '{{#each data.items as=item}}{{#if rule={"field":"item.active","operator":"equals","value":true}}}x{{/if}}{{/each}}',
      { data: { items: [{ active: true }, { active: false }] } },
      defaultEmailLens,
      (m) => errors.push(m.detail),
    );
    expect(out).toBe('x');
    expect(errors).toEqual([]);
  });

  it('a rule on the loop index evaluates without a lens question', () => {
    const errors: string[] = [];
    const out = evaluateConditions(
      '{{#each data.items as=item index=i}}{{#if rule={"field":"i","operator":"lessThan","value":1}}}first{{/if}}{{/each}}',
      { data: { items: [1, 2] } },
      defaultEmailLens,
      (m) => errors.push(m.detail),
    );
    expect(out).toBe('first');
    expect(errors).toEqual([]);
  });

  it('an unterminated {{#if}} renders nothing from the marker on and sinks a rule issue', () => {
    const errors: string[] = [];
    const out = evaluateConditions('hello {{#if rule=true}}NAME', {}, defaultEmailLens, (m) =>
      errors.push(m.detail),
    );
    expect(out).toBe('hello ');
    expect(errors).toEqual(['unterminated {{#if}} block - missing {{/if}}']);
  });

  it('an each filter naming a gone row degrades the whole block, never a partial list', () => {
    const errors: string[] = [];
    const out = evaluateConditions(
      '{{#each recipient.tagAttachments as=a filter={"field":"a.tag.id","operator":"equals","value":"tag-1"}}}x{{/each}}',
      { recipient: { tagAttachments: [{ tag: { id: 'tag-1' } }] } },
      defaultEmailLens,
      (m) => errors.push(m.detail),
      new Set(),
    );
    expect(out).toBe('');
    expect(errors).toEqual(['rule names a Tag that no longer resolves: tag-1']);
  });
});
