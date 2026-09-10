import { describe, expect, it, spyOn } from 'bun:test';
import { interpolate } from '@template/email/render/interpolate';
import { EACH_MAX_DEPTH, EACH_MAX_ELEMENTS } from '@template/email/render/limits';
import { SYSTEM_TOKENS } from '@template/email/render/systemTokens';

describe('interpolate', () => {
  describe('variable substitution', () => {
    it('substitutes sender variables', () => {
      const result = interpolate('Hello from {{sender.name}}', {
        sender: { name: 'Acme Corp' },
      });
      expect(result).toBe('Hello from Acme Corp');
    });

    it('substitutes recipient variables', () => {
      const result = interpolate('Hi {{recipient.name}}, your email is {{recipient.email}}', {
        recipient: { name: 'John', email: 'john@example.com' },
      });
      expect(result).toBe('Hi John, your email is john@example.com');
    });

    it('substitutes data values', () => {
      const result = interpolate('Your code is {{data.code}}', {
        data: { code: '123456' },
      });
      expect(result).toBe('Your code is 123456');
    });

    it('substitutes system lens values', () => {
      const result = interpolate('Manage your prefs: {{system.preferencesUrl}}', {
        system: { preferencesUrl: 'https://app.example.com/prefs' },
      });
      expect(result).toBe('Manage your prefs: https://app.example.com/prefs');
    });

    it('resolves all four lenses together', () => {
      const result = interpolate('{{sender.name}}→{{recipient.name}}:{{data.code}} [{{system.appName}}]', {
        sender: { name: 'Acme' },
        recipient: { name: 'Jo' },
        data: { code: '42' },
        system: { appName: 'Tmpl' },
      });
      expect(result).toBe('Acme→Jo:42 [Tmpl]');
    });

    it('renders empty and sinks a token issue when the value is missing — never the literal token', () => {
      const issues: string[] = [];
      const result = interpolate('Hello {{recipient.name}}', {}, (issue) => issues.push(`${issue.kind}:${issue.path}`));
      expect(result).toBe('Hello ');
      expect(issues).toEqual(['token:recipient.name']);
    });

    it('escapes HTML in values', () => {
      const result = interpolate('Hello {{recipient.name}}', {
        recipient: { name: '<script>alert("xss")</script>' },
      });
      expect(result).toBe('Hello &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('handles multiple prefixes', () => {
      const result = interpolate('{{sender.name}} sent {{recipient.name}} code {{data.code}}', {
        sender: { name: 'Acme' },
        recipient: { name: 'John' },
        data: { code: '999' },
      });
      expect(result).toBe('Acme sent John code 999');
    });

    it('handles hyphenated keys', () => {
      const result = interpolate('Hi {{recipient.first-name}} {{recipient.last-name}}', {
        recipient: { 'first-name': 'John', 'last-name': 'Doe' },
      });
      expect(result).toBe('Hi John Doe');
    });

    it('resolves nested paths', () => {
      const result = interpolate('Org: {{data.org.name}}, role: {{data.member.role}}', {
        data: { org: { name: 'Acme' }, member: { role: 'admin' } },
      });
      expect(result).toBe('Org: Acme, role: admin');
    });

    it('does not resolve prototype-chain or inherited-function paths', () => {
      const template = '{{data.constructor.name}}|{{data.__proto__.x}}|{{data.prototype}}|{{data.toString}}';
      const result = interpolate(template, { data: {} });
      expect(result).toBe('|||');
    });
  });

  // why: rules are checked against the real lens at evaluation — `data.*` is the free-form Json
  // why: bucket the lens admits; a made-up recipient column is a vocabulary violation, not a match.
  describe('conditional blocks', () => {
    it('includes content when rule matches', () => {
      const result = interpolate(
        'Hello{{#if rule={"field":"data.role","operator":"equals","value":"admin"}}} Admin{{/if}}!',
        { data: { role: 'admin' } },
      );
      expect(result).toBe('Hello Admin!');
    });

    it('excludes content when rule does not match', () => {
      const result = interpolate(
        'Hello{{#if rule={"field":"data.role","operator":"equals","value":"admin"}}} Admin{{/if}}!',
        { data: { role: 'user' } },
      );
      expect(result).toBe('Hello!');
    });

    it('handles compound all rule', () => {
      const rule = JSON.stringify({
        all: [
          { field: 'data.role', operator: 'equals', value: 'admin' },
          { field: 'data.verified', operator: 'equals', value: true },
        ],
      });
      const result = interpolate(`Show{{#if rule=${rule}}} secret{{/if}} content`, {
        data: { role: 'admin', verified: true },
      });
      expect(result).toBe('Show secret content');
    });

    it('handles compound any rule', () => {
      const rule = JSON.stringify({
        any: [
          { field: 'data.role', operator: 'equals', value: 'admin' },
          { field: 'data.role', operator: 'equals', value: 'owner' },
        ],
      });
      const result = interpolate(`{{#if rule=${rule}}}Privileged{{/if}}`, {
        data: { role: 'owner' },
      });
      expect(result).toBe('Privileged');
    });

    it('substitutes variables after conditional evaluation', () => {
      const rule = JSON.stringify({ field: 'data.premium', operator: 'equals', value: true });
      const result = interpolate(`Hi {{recipient.name}}{{#if rule=${rule}}}, thanks for being premium{{/if}}!`, {
        recipient: { name: 'John' },
        data: { premium: true },
      });
      expect(result).toBe('Hi John, thanks for being premium!');
    });

    it('handles multiple conditionals', () => {
      const adminRule = JSON.stringify({ field: 'data.role', operator: 'equals', value: 'admin' });
      const premiumRule = JSON.stringify({ field: 'data.premium', operator: 'equals', value: true });

      const result = interpolate(
        `{{#if rule=${adminRule}}}[Admin]{{/if}}{{#if rule=${premiumRule}}}[Premium]{{/if}} User`,
        { data: { role: 'admin', premium: false } },
      );
      expect(result).toBe('[Admin] User');
    });

    it('handles in operator', () => {
      const rule = JSON.stringify({
        field: 'data.role',
        operator: 'in',
        value: ['admin', 'owner', 'manager'],
      });
      const result = interpolate(`{{#if rule=${rule}}}Manager View{{/if}}`, {
        data: { role: 'manager' },
      });
      expect(result).toBe('Manager View');
    });

    it('handles notEquals operator', () => {
      const rule = JSON.stringify({
        field: 'data.status',
        operator: 'notEquals',
        value: 'banned',
      });
      const result = interpolate(`{{#if rule=${rule}}}Welcome{{/if}}`, {
        data: { status: 'active' },
      });
      expect(result).toBe('Welcome');
    });

    it('handles braces inside string values', () => {
      const rule = JSON.stringify({
        field: 'data.msg',
        operator: 'equals',
        value: 'use {braces} here',
      });
      const result = interpolate(`{{#if rule=${rule}}}Matched{{/if}}`, {
        data: { msg: 'use {braces} here' },
      });
      expect(result).toBe('Matched');
    });

    it('drops a malformed-rule block by default and reports it via onError', () => {
      const errors: string[] = [];
      const result = interpolate('{{#if rule={invalid json}}}Content{{else}}Fallback{{/if}}', { recipient: {} }, (m) =>
        errors.push(m.detail),
      );
      expect(result).toBe('Fallback');
      expect(errors).toHaveLength(1);
    });
  });

  describe('system tokens', () => {
    const utcYear = String(new Date().getUTCFullYear());

    it('resolves reserved system tokens from the engine clock at send time', () => {
      const result = interpolate('© {{system.year}} — sent {{system.now}}', {});
      expect(result).toContain(`© ${utcYear} —`);
      expect(result).not.toContain('{{system.now}}');
    });

    it('resolves every token the shared list offers', () => {
      for (const { name } of SYSTEM_TOKENS) {
        const token = `{{system.${name}}}`;
        expect(interpolate(token, {})).not.toContain(token);
      }
    });

    it('is not overridable by a caller-supplied system bucket', () => {
      const result = interpolate('{{system.year}}', { system: { year: 'HACKED' } } as never);
      expect(result).toBe(utcYear);
    });

    it('renders unknown and nested system tokens empty and sinks them', () => {
      const issues: string[] = [];
      expect(interpolate('{{system.unknown}} {{system.now.iso}}', {}, (issue) => issues.push(issue.path ?? ''))).toBe(
        ' ',
      );
      expect(issues).toEqual(['system.unknown', 'system.now.iso']);
    });

    it('does not resolve inherited Object.prototype members as system tokens', () => {
      const template = '{{system.__proto__}}|{{system.toString}}|{{system.constructor}}';
      expect(interpolate(template, {})).toBe('||');
    });

    it('formats system.now in the caller-provided locale', () => {
      const enUS = interpolate('{{system.now}}', {}, undefined, { locale: 'en-US' });
      const enGB = interpolate('{{system.now}}', {}, undefined, { locale: 'en-GB' });
      // Same instant, both English: en-US is month-first with a comma, en-GB day-first without one.
      expect(enUS).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
      expect(enGB).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/);
    });

    it('formats system.now on the UTC calendar day, not the host time zone', () => {
      const utcToday = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      });
      expect(interpolate('{{system.now}}', {}, undefined, { locale: 'en-US' })).toBe(utcToday);
    });

    it('degrades a malformed locale to the runtime default instead of failing the send', () => {
      const result = interpolate('{{system.now}}', {}, undefined, { locale: 'not_a_locale' });
      expect(result).not.toContain('{{system.now}}');
      expect(result).toMatch(/\d{4}/);
    });

    it('resolves inside a conditional body', () => {
      const rule = JSON.stringify({ field: 'data.plan', operator: 'equals', value: 'pro' });
      const result = interpolate(`{{#if rule=${rule}}}{{system.year}}{{/if}}`, { data: { plan: 'pro' } });
      expect(result).toBe(utcYear);
    });

    it('does not resolve a system token carried in a caller value', () => {
      const result = interpolate('{{data.note}}', { data: { note: '{{system.year}}' } });
      expect(result).toBe('{{system.year}}');
    });

    it('reads the clock once per render, so tokens in one email agree with each other', () => {
      const RealDate = Date;
      let ticks = 0;
      const clock = spyOn(globalThis, 'Date').mockImplementation(
        (() => new RealDate(RealDate.UTC(2026 + ticks++, 11, 31, 23, 59, 59))) as never,
      );
      try {
        const [first, second, year] = interpolate('{{system.now}} / {{system.now}} / {{system.year}}', {}).split(' / ');
        expect(second).toBe(first as string);
        expect(year).toBe('2026');
      } finally {
        clock.mockRestore();
      }
    });
  });
});

describe('interpolate — {{#each}} grammar', () => {
  it('substitutes a bare binding token per element when the element is a primitive', () => {
    expect(interpolate('{{#each data.items as=item}}[{{item}}]{{/each}}', { data: { items: ['a', 'b', 'c'] } })).toBe(
      '[a][b][c]',
    );
  });

  it('tolerates as=/index=/filter= attributes in any order', () => {
    const filterJson = '{"field":"item.ok","operator":"equals","value":true}';
    const result = interpolate(`{{#each data.items index=i filter=${filterJson} as=item}}{{i}}:{{item.n}} {{/each}}`, {
      data: {
        items: [
          { n: 1, ok: true },
          { n: 2, ok: false },
        ],
      },
    });
    expect(result).toBe('0:1 ');
  });

  it('tolerates whitespace inside an {{#if}} marker within a loop body', () => {
    const result = interpolate(
      '{{#each data.items as=item}}{{#if rule= {"field":"item.ok","operator":"equals","value":true} }}Y{{/if}}{{/each}}',
      { data: { items: [{ ok: true }, { ok: false }] } },
    );
    expect(result).toBe('Y');
  });
});

describe('interpolate — {{#each}} scope', () => {
  it('an unresolved identifier (not a binding, not a reserved root) renders empty and sinks', () => {
    const errors: string[] = [];
    expect(interpolate('{{notabinding}}', {}, (m) => errors.push(m.detail))).toBe('');
    expect(errors).toEqual(['{{notabinding}} names no scope root or loop binding']);
  });

  it('an inherited Object.prototype property is not mistaken for an in-scope binding', () => {
    const errors: string[] = [];
    const result = interpolate('{{constructor}} {{constructor.name}}', {}, (m) => errors.push(m.detail));
    expect(result).toBe(' ');
    expect(errors).toHaveLength(2);
  });

  it('as=system fails closed instead of half-resolving against the pre-pass or the system scope', () => {
    const errors: string[] = [];
    const result = interpolate(
      '{{#each data.items as=system}}{{system.now}}|{{system.label}}{{/each}}',
      { data: { items: [{ label: 'shadowed', now: 'shadowed' }] } },
      (m) => errors.push(m.detail),
    );
    expect(result).toBe('');
    expect(errors).toEqual(['as= "system" collides with a reserved or enclosing binding']);
  });

  it('unknown or duplicate attributes fail closed at render time', () => {
    const errors: string[] = [];
    const result = interpolate(
      '{{#each data.items as=first typo=value as=second}}{{second}}{{/each}}',
      { data: { items: ['unsafe'] } },
      (m) => errors.push(m.detail),
    );
    expect(result).toBe('');
    expect(errors).toEqual([
      'unknown typo= attribute on {{#each}} block',
      'duplicate as= attribute on {{#each}} block',
    ]);
  });

  it('an attribute missing = fails closed without being treated as an unterminated block', () => {
    const errors: string[] = [];
    const result = interpolate('{{#each data.items as item}}X{{/each}}', { data: { items: ['unsafe'] } }, (m) =>
      errors.push(m.detail),
    );
    expect(result).toBe('');
    expect(errors).toEqual([
      'malformed attribute "as" on {{#each}} block (expected name=value)',
      'malformed attribute "item" on {{#each}} block (expected name=value)',
    ]);
  });

  it('a nested binding path resolving to a non-primitive renders empty AND sinks', () => {
    const errors: string[] = [];
    const result = interpolate(
      '{{#each data.items as=item}}{{item.meta}}{{/each}}',
      { data: { items: [{ meta: { a: 1 } }] } },
      (m) => errors.push(m.detail),
    );
    expect(result).toBe('');
    expect(errors).toEqual(['{{item.meta}} resolved to a non-primitive value']);
  });
});

describe('interpolate — prototype-chain token safety on bindings', () => {
  it('renders a constructor token on an each binding empty', () => {
    expect(interpolate('{{#each data.items as=item}}{{item.constructor}}{{/each}}', { data: { items: [{}] } })).toBe(
      '',
    );
  });

  it('renders function-valued each-binding properties empty', () => {
    expect(
      interpolate('{{#each data.items as=item}}{{item.fn}}{{/each}}', {
        data: { items: [{ fn: () => 'should not render' }] },
      }),
    ).toBe('');
  });
});

describe('interpolate — {{#each}} semantics', () => {
  it('an empty array renders empty with no sink', () => {
    const errors: string[] = [];
    expect(
      interpolate('{{#each data.items as=item}}X{{/each}}', { data: { items: [] } }, (m) => errors.push(m.detail)),
    ).toBe('');
    expect(errors).toEqual([]);
  });

  it('a malformed filter still sinks when the loop path is empty or missing', () => {
    for (const variables of [{ data: { items: [] } }, { data: {} }]) {
      const errors: string[] = [];
      const result = interpolate('{{#each data.items as=item filter={bad json}}}X{{/each}}', variables, (m) =>
        errors.push(m.detail),
      );
      expect(result).toBe('');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toStartWith('invalid filter JSON - ');
    }
  });

  it('filter= excludes non-matching elements; index= counts the POST-FILTER sequence', () => {
    const filterJson = '{"field":"item.ok","operator":"equals","value":true}';
    const result = interpolate(
      `{{#each data.items as=item index=i filter=${filterJson}}}{{i}}:{{item.name}} {{/each}}`,
      {
        data: {
          items: [
            { name: 'A', ok: false },
            { name: 'B', ok: true },
            { name: 'C', ok: false },
            { name: 'D', ok: true },
          ],
        },
      },
    );
    expect(result).toBe('0:B 1:D ');
  });

  it('filter= path RHS reference resolves against an ENCLOSING loop binding', () => {
    const template =
      '{{#each data.missions as=m}}' +
      '{{#each m.rewards as=r filter={"field":"r.tier","operator":"greaterThanEquals","path":"m.minTier"}}}' +
      '{{r.tier}} ' +
      '{{/each}}' +
      '{{/each}}';
    const result = interpolate(template, {
      data: { missions: [{ minTier: 2, rewards: [{ tier: 1 }, { tier: 2 }, { tier: 3 }] }] },
    });
    expect(result).toBe('2 3 ');
  });

  it('check() returning a string (missing leaf) is a silent non-match — no sink', () => {
    const errors: string[] = [];
    const result = interpolate(
      '{{#each data.items as=item filter={"field":"item.missingField","operator":"equals","value":"x"}}}{{item.n}}{{/each}}',
      { data: { items: [{ n: 1 }, { n: 2 }] } },
      (m) => errors.push(m.detail),
    );
    expect(result).toBe('');
    expect(errors).toEqual([]);
  });

  it('check() throwing excludes that element and sinks once per loop (deduped)', () => {
    const errors: string[] = [];
    const result = interpolate(
      '{{#each data.items as=item filter={"field":"item.x","operator":"nope","value":1}}}{{item.n}}{{/each}}',
      {
        data: {
          items: [
            { n: 1, x: 1 },
            { n: 2, x: 1 },
          ],
        },
      },
      (m) => errors.push(m.detail),
    );
    expect(result).toBe('');
    expect(errors).toHaveLength(1);
  });
});

describe('interpolate — {{#each}} structural-error posture', () => {
  it('an unterminated {{#each}} dumps the remainder verbatim (still substituted) and sinks', () => {
    const errors: string[] = [];
    const result = interpolate(
      'before {{data.x}} {{#each data.items as=item}}tail',
      { data: { x: 'V', items: [1] } },
      (m) => errors.push(m.detail),
    );
    expect(result).toBe('before V {{#each data.items as=item}}tail');
    expect(errors).toEqual(['unterminated {{#each}} block - missing {{/each}}']);
  });

  it('a kind-mismatched close ({{#each}}...{{/if}}) degrades to unterminated-each and sinks', () => {
    const errors: string[] = [];
    const result = interpolate('{{#each data.items as=item}}X{{/if}}', { data: { items: [1] } }, (m) =>
      errors.push(m.detail),
    );
    expect(result).toBe('{{#each data.items as=item}}X{{/if}}');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('an orphan close at depth 0 stays inert and silent for {{/each}} and {{/if}} alike', () => {
    const errors: string[] = [];
    expect(interpolate('hello {{/each}} world', {}, (m) => errors.push(m.detail))).toBe('hello {{/each}} world');
    expect(interpolate('hello {{/if}} world', {}, (m) => errors.push(m.detail))).toBe('hello {{/if}} world');
    expect(errors).toEqual([]);
  });
});

describe('interpolate — substitution exactly-once (injection)', () => {
  it('a data value containing literal {{recipient.x}} text is NOT resolved (no trailing re-scan)', () => {
    const result = interpolate('{{data.evil}}', {
      data: { evil: '{{recipient.email}}' },
      recipient: { email: 'real@example.com' },
    });
    expect(result).toBe('{{recipient.email}}');
  });

  it('the same injection guard holds for a value substituted from inside a loop body', () => {
    const result = interpolate('{{#each data.items as=item}}{{item}}{{/each}}', {
      data: { items: ['{{recipient.email}}'] },
      recipient: { email: 'real@example.com' },
    });
    expect(result).toBe('{{recipient.email}}');
  });
});

describe('interpolate — reserved-root carve-out characterization', () => {
  it('an array value is non-primitive: empty, with a token issue', () => {
    const issues: string[] = [];
    expect(interpolate('{{data.tags}}', { data: { tags: ['a', 'b'] } }, (issue) => issues.push(issue.detail))).toBe('');
    expect(issues).toEqual(['{{data.tags}} resolved to a non-primitive value']);
  });

  it('an object value is non-primitive: empty, with a token issue', () => {
    expect(interpolate('{{data.obj}}', { data: { obj: { x: 1 } } })).toBe('');
  });

  it('the number 0 and the boolean false substitute, not treated as missing values', () => {
    expect(interpolate('{{data.n}}', { data: { n: 0 } })).toBe('0');
    expect(interpolate('{{data.flag}}', { data: { flag: false } })).toBe('false');
  });

  it('a reserved token span crossing an if marker boundary is reassembled, never substituted', () => {
    const result = interpolate('{{data.{{#if rule=true}}x{{/if}}}}', { data: { x: 'SHOULD_NOT_APPEAR' } });
    expect(result).toBe('{{data.x}}');
  });
});

describe('interpolate — {{#each}} expansion bounds', () => {
  const items = (count: number) => Array.from({ length: count }, (_, i) => ({ n: i }));

  it(`expands a loop at exactly the ${EACH_MAX_ELEMENTS}-element limit`, () => {
    const errors: string[] = [];
    const result = interpolate(
      '{{#each data.items as=item}}X{{/each}}',
      { data: { items: items(EACH_MAX_ELEMENTS) } },
      (m) => errors.push(m.detail),
    );
    expect(result).toBe('X'.repeat(EACH_MAX_ELEMENTS));
    expect(errors).toEqual([]);
  });

  it('sinks and renders nothing one element over the limit', () => {
    const errors: string[] = [];
    const result = interpolate(
      '{{#each data.items as=item}}X{{/each}}',
      { data: { items: items(EACH_MAX_ELEMENTS + 1) } },
      (m) => errors.push(m.detail),
    );
    expect(result).toBe('');
    expect(errors).toEqual([
      `{{#each data.items}} resolved to ${EACH_MAX_ELEMENTS + 1} elements, over the ${EACH_MAX_ELEMENTS}-element limit`,
    ]);
  });

  it('bounds the SOURCE array, so a narrowing filter= cannot smuggle an over-cap loop through', () => {
    const errors: string[] = [];
    const result = interpolate(
      '{{#each data.items as=item filter={"field":"item.n","operator":"equals","value":0}}}X{{/each}}',
      { data: { items: items(EACH_MAX_ELEMENTS + 1) } },
      (m) => errors.push(m.detail),
    );
    expect(result).toBe('');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('over the');
  });

  it(`expands loops nested exactly ${EACH_MAX_DEPTH} deep`, () => {
    const errors: string[] = [];
    const result = interpolate(
      '{{#each data.items as=a}}{{#each a.kids as=b}}{{b.v}}{{/each}}{{/each}}',
      { data: { items: [{ kids: [{ v: 'x' }, { v: 'y' }] }] } },
      (m) => errors.push(m.detail),
    );
    expect(result).toBe('xy');
    expect(errors).toEqual([]);
  });

  it(`sinks and renders nothing one level deeper than ${EACH_MAX_DEPTH}`, () => {
    const errors: string[] = [];
    const result = interpolate(
      '{{#each data.items as=a}}{{#each a.kids as=b}}{{#each b.grandkids as=c}}{{c.v}}{{/each}}{{/each}}{{/each}}',
      { data: { items: [{ kids: [{ grandkids: [{ v: 'x' }] }] }] } },
      (m) => errors.push(m.detail),
    );
    expect(result).toBe('');
    expect(errors).toEqual([`{{#each}} blocks nested more than ${EACH_MAX_DEPTH} deep are not supported`]);
  });

  it('the depth cap resets across sibling loops — only true nesting counts', () => {
    const errors: string[] = [];
    const result = interpolate(
      '{{#each data.a as=x}}{{#each x.k as=y}}{{y}}{{/each}}{{/each}}|{{#each data.a as=x}}{{#each x.k as=y}}{{y}}{{/each}}{{/each}}',
      { data: { a: [{ k: [1] }] } },
      (m) => errors.push(m.detail),
    );
    expect(result).toBe('1|1');
    expect(errors).toEqual([]);
  });
});
