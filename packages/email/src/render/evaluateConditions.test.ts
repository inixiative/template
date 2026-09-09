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

describe('evaluateConditions — render-error reporting', () => {
  const broken = '{{#if rule={bad json}}}A{{else}}B{{/if}}';

  it('reports a malformed rule via onError and skips the branch (degrades) by default', () => {
    const errors: string[] = [];
    const out = evaluateConditions(broken, {}, (m) => errors.push(m));
    expect(out).toBe('B');
    expect(errors).toHaveLength(1);
  });

  it('never calls onError when every rule is valid', () => {
    const errors: string[] = [];
    evaluateConditions('{{#if rule=true}}X{{else}}Y{{/if}}', {}, (m) => errors.push(m));
    expect(errors).toEqual([]);
  });

  it('emits the offending block inline only when EMAIL_INLINE_RENDER_ERRORS is set', () => {
    const prev = process.env.EMAIL_INLINE_RENDER_ERRORS;
    process.env.EMAIL_INLINE_RENDER_ERRORS = 'true';
    try {
      const out = evaluateConditions(broken, {});
      expect(out).toContain('RULE ERROR');
      expect(out).toContain('A');
    } finally {
      if (prev === undefined) delete process.env.EMAIL_INLINE_RENDER_ERRORS;
      else process.env.EMAIL_INLINE_RENDER_ERRORS = prev;
    }
  });
});

describe('evaluateConditions — non-object rules', () => {
  it('renders bare boolean rules (true/false are valid Conditions)', () => {
    expect(evaluateConditions('{{#if rule=true}}X{{/if}}', {})).toBe('X');
    expect(evaluateConditions('{{#if rule=false}}X{{else}}Y{{/if}}', {})).toBe('Y');
  });

  it('a boolean rule in a nested block does not corrupt the outer block', () => {
    const outer = rule('recipient.tier', 'equals', 'gold');
    const tpl = `{{#if rule=${outer}}}A{{#if rule=true}}B{{/if}}C{{else}}D{{/if}}`;
    expect(evaluateConditions(tpl, { recipient: { tier: 'gold' } })).toBe('ABC');
    expect(evaluateConditions(tpl, { recipient: { tier: 'x' } })).toBe('D');
  });
});

const ENV_KEY = 'EMAIL_INLINE_RENDER_ERRORS';

const withInlineErrors = <T>(value: string | undefined, fn: () => T): T => {
  const previous = process.env[ENV_KEY];
  if (value === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = previous;
  }
};

describe('evaluateConditions — check() throwing at evaluation time', () => {
  const THROWING_RULE = '{{#if rule={"field":"recipient.plan","operator":"nope","value":"pro"}}}A{{else}}B{{/if}}';

  it('reports the thrown rule error via onError and skips the branch by default', () => {
    const errors: string[] = [];
    const output = evaluateConditions(THROWING_RULE, { recipient: { plan: 'pro' } }, (m) => errors.push(m));

    expect(output).toBe('B');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Unknown operator');
  });

  it('renders the offending branch inline when EMAIL_INLINE_RENDER_ERRORS is set', () => {
    const output = withInlineErrors('true', () => evaluateConditions(THROWING_RULE, { recipient: { plan: 'pro' } }));

    expect(output).toContain('RULE ERROR');
    expect(output).toContain('Unknown operator');
    expect(output).toContain('A');
  });

  it('skips the throwing branch and continues to a later else-if that matches', () => {
    const template =
      '{{#if rule={"field":"recipient.plan","operator":"nope","value":"pro"}}}A' +
      '{{else if rule={"field":"recipient.plan","operator":"equals","value":"pro"}}}C{{else}}B{{/if}}';

    expect(evaluateConditions(template, { recipient: { plan: 'pro' } })).toBe('C');
  });
});

describe('evaluateConditions — unterminated block', () => {
  it('passes the remaining content through verbatim when the {{#if}} has no {{/if}}', () => {
    expect(evaluateConditions('before {{#if rule=true}}A', { recipient: {} })).toBe('before {{#if rule=true}}A');
  });

  it('renders content before an unterminated block and stops at it', () => {
    const output = evaluateConditions('lead {{#if rule={"field":}}}tail', { recipient: {} });

    expect(output).toContain('lead ');
    expect(output).toContain('{{#if rule={"field":}}}tail');
  });
});

describe('evaluateConditions — undefined variable stripping', () => {
  it('drops undefined top-level variable groups from the rule data', () => {
    const output = evaluateConditions(
      '{{#if rule={"field":"recipient.name","operator":"isDefined","value":true}}}has{{else}}none{{/if}}',
      { recipient: undefined, data: { x: 1 } },
    );

    expect(output).toBe('none');
  });
});

describe('evaluateConditions — {{#each}} filter errors, the each-analog of the if-branch affordance', () => {
  const THROWING_FILTER =
    '{{#each data.items as=item filter={"field":"item.x","operator":"nope","value":1}}}{{item.n}}{{/each}}';

  it('a throwing filter check() sinks once and excludes every element by default', () => {
    const errors: string[] = [];
    const output = evaluateConditions(THROWING_FILTER, { data: { items: [{ x: 1 }, { x: 1 }] } }, (m) =>
      errors.push(m),
    );

    expect(output).toBe('');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Unknown operator');
  });

  it('renders the each body inline (unchanged scope) when EMAIL_INLINE_RENDER_ERRORS is set', () => {
    const output = withInlineErrors('true', () => evaluateConditions(THROWING_FILTER, { data: { items: [{ x: 1 }] } }));

    expect(output).toContain('RULE ERROR');
    expect(output).toContain('Unknown operator');
  });

  it('malformed filter= JSON sinks and renders empty by default', () => {
    const errors: string[] = [];
    const output = evaluateConditions(
      '{{#each data.items as=item filter={bad json}}}X{{/each}}',
      { data: { items: [1] } },
      (m) => errors.push(m),
    );

    expect(output).toBe('');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('invalid filter JSON');
  });

  it('malformed filter= JSON renders inline when EMAIL_INLINE_RENDER_ERRORS is set', () => {
    const output = withInlineErrors('true', () =>
      evaluateConditions('{{#each data.items as=item filter={bad json}}}X{{/each}}', { data: { items: [1] } }),
    );

    expect(output).toContain('RULE ERROR');
  });
});

describe('evaluateConditions — {{#each}} resolved structurally, never substituted', () => {
  it('iterates and filters, but leaves binding + reserved-root tokens inside the body unsubstituted', () => {
    expect(evaluateConditions('{{#each data.items as=item}}[{{item}}]{{/each}}', { data: { items: ['a', 'b'] } })).toBe(
      '[{{item}}][{{item}}]',
    );
  });

  it('filter= still excludes elements structurally', () => {
    const result = evaluateConditions(
      '{{#each data.items as=item filter={"field":"item.ok","operator":"equals","value":true}}}X{{/each}}',
      { data: { items: [{ ok: false }, { ok: true }] } },
    );

    expect(result).toBe('X');
  });

  it('an empty array still renders empty with no structural change', () => {
    expect(evaluateConditions('{{#each data.items as=item}}X{{/each}}', { data: { items: [] } })).toBe('');
  });
});
