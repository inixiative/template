import { describe, expect, it } from 'bun:test';
import { interpolate } from '@template/email/render/interpolate';
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

    it('keeps placeholder if value not found', () => {
      const result = interpolate('Hello {{recipient.name}}', {});
      expect(result).toBe('Hello {{recipient.name}}');
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
      expect(result).toBe(template);
    });
  });

  describe('conditional blocks', () => {
    it('includes content when rule matches', () => {
      const result = interpolate(
        'Hello{{#if rule={"field":"recipient.role","operator":"equals","value":"admin"}}} Admin{{/if}}!',
        { recipient: { role: 'admin' } },
      );
      expect(result).toBe('Hello Admin!');
    });

    it('excludes content when rule does not match', () => {
      const result = interpolate(
        'Hello{{#if rule={"field":"recipient.role","operator":"equals","value":"admin"}}} Admin{{/if}}!',
        { recipient: { role: 'user' } },
      );
      expect(result).toBe('Hello!');
    });

    it('handles compound all rule', () => {
      const rule = JSON.stringify({
        all: [
          { field: 'recipient.role', operator: 'equals', value: 'admin' },
          { field: 'recipient.verified', operator: 'equals', value: true },
        ],
      });
      const result = interpolate(`Show{{#if rule=${rule}}} secret{{/if}} content`, {
        recipient: { role: 'admin', verified: true },
      });
      expect(result).toBe('Show secret content');
    });

    it('handles compound any rule', () => {
      const rule = JSON.stringify({
        any: [
          { field: 'recipient.role', operator: 'equals', value: 'admin' },
          { field: 'recipient.role', operator: 'equals', value: 'owner' },
        ],
      });
      const result = interpolate(`{{#if rule=${rule}}}Privileged{{/if}}`, {
        recipient: { role: 'owner' },
      });
      expect(result).toBe('Privileged');
    });

    it('substitutes variables after conditional evaluation', () => {
      const rule = JSON.stringify({ field: 'recipient.premium', operator: 'equals', value: true });
      const result = interpolate(`Hi {{recipient.name}}{{#if rule=${rule}}}, thanks for being premium{{/if}}!`, {
        recipient: { name: 'John', premium: true },
      });
      expect(result).toBe('Hi John, thanks for being premium!');
    });

    it('handles multiple conditionals', () => {
      const adminRule = JSON.stringify({ field: 'recipient.role', operator: 'equals', value: 'admin' });
      const premiumRule = JSON.stringify({ field: 'recipient.premium', operator: 'equals', value: true });

      const result = interpolate(
        `{{#if rule=${adminRule}}}[Admin]{{/if}}{{#if rule=${premiumRule}}}[Premium]{{/if}} User`,
        { recipient: { role: 'admin', premium: false } },
      );
      expect(result).toBe('[Admin] User');
    });

    it('handles in operator', () => {
      const rule = JSON.stringify({
        field: 'recipient.role',
        operator: 'in',
        value: ['admin', 'owner', 'manager'],
      });
      const result = interpolate(`{{#if rule=${rule}}}Manager View{{/if}}`, {
        recipient: { role: 'manager' },
      });
      expect(result).toBe('Manager View');
    });

    it('handles notEquals operator', () => {
      const rule = JSON.stringify({
        field: 'recipient.status',
        operator: 'notEquals',
        value: 'banned',
      });
      const result = interpolate(`{{#if rule=${rule}}}Welcome{{/if}}`, {
        recipient: { status: 'active' },
      });
      expect(result).toBe('Welcome');
    });

    it('handles braces inside string values', () => {
      const rule = JSON.stringify({
        field: 'recipient.msg',
        operator: 'equals',
        value: 'use {braces} here',
      });
      const result = interpolate(`{{#if rule=${rule}}}Matched{{/if}}`, {
        recipient: { msg: 'use {braces} here' },
      });
      expect(result).toBe('Matched');
    });

    it('drops a malformed-rule block by default and reports it via onError', () => {
      const errors: string[] = [];
      const result = interpolate('{{#if rule={invalid json}}}Content{{else}}Fallback{{/if}}', { recipient: {} }, (m) =>
        errors.push(m),
      );
      expect(result).toBe('Fallback');
      expect(errors).toHaveLength(1);
    });

    it('surfaces a malformed rule inline when EMAIL_INLINE_RENDER_ERRORS is set', () => {
      const prev = process.env.EMAIL_INLINE_RENDER_ERRORS;
      process.env.EMAIL_INLINE_RENDER_ERRORS = 'true';
      try {
        const result = interpolate('{{#if rule={invalid json}}}Content{{/if}}', { recipient: {} });
        expect(result).toContain('<!-- RULE ERROR:');
        expect(result).toContain('Content');
      } finally {
        if (prev === undefined) delete process.env.EMAIL_INLINE_RENDER_ERRORS;
        else process.env.EMAIL_INLINE_RENDER_ERRORS = prev;
      }
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

    it('leaves unknown and nested system tokens literal', () => {
      expect(interpolate('{{system.unknown}} {{system.now.iso}}', {})).toBe('{{system.unknown}} {{system.now.iso}}');
    });

    it('does not resolve inherited Object.prototype members as system tokens', () => {
      const template = '{{system.__proto__}}|{{system.toString}}|{{system.constructor}}';
      expect(interpolate(template, {})).toBe(template);
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
      const rule = JSON.stringify({ field: 'recipient.plan', operator: 'equals', value: 'pro' });
      const result = interpolate(`{{#if rule=${rule}}}{{system.year}}{{/if}}`, { recipient: { plan: 'pro' } });
      expect(result).toBe(utcYear);
    });

    it('does not resolve a system token carried in a caller value', () => {
      const result = interpolate('{{data.note}}', { data: { note: '{{system.year}}' } });
      expect(result).toBe('{{system.year}}');
    });

    it('reads the clock once per render, so tokens in one email agree with each other', () => {
      const RealDate = Date;
      let ticks = 0;
      // @ts-expect-error — swapping the global clock is the point of the test.
      globalThis.Date = class extends RealDate {
        constructor() {
          super(RealDate.UTC(2026 + ticks++, 11, 31, 23, 59, 59));
        }
      };
      try {
        const [first, second, year] = interpolate('{{system.now}} / {{system.now}} / {{system.year}}', {}).split(' / ');
        expect(second).toBe(first as string);
        expect(year).toBe('2026');
      } finally {
        globalThis.Date = RealDate;
      }
    });
  });
});
