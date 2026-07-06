import { describe, expect, test } from 'bun:test';
import { decompose, serialize } from '@template/email/render/decompose';
import { parseBlocks } from '@template/email/render/parseBlocks';

// A cascade resolver that knows nothing (every component is new).
const noCascade = () => undefined;

describe('serialize (parseBlocks inverse)', () => {
  const roundtrip = (s: string) => serialize(parseBlocks(s));

  test('round-trips text', () => {
    expect(roundtrip('<mj-text>hi</mj-text>')).toBe('<mj-text>hi</mj-text>');
  });

  test('round-trips a bare component ref', () => {
    expect(roundtrip('{{#component:footer}}{{/component:footer}}')).toBe('{{#component:footer}}{{/component:footer}}');
  });

  test('round-trips a ref with an override slot', () => {
    const s = '{{#component:card}}{{#slot:body}}<mj-text>x</mj-text>{{/slot:body}}{{/component:card}}';
    expect(roundtrip(s)).toBe(s);
  });

  test('round-trips a default slot (with :default on close)', () => {
    const s = '{{#slot:footer:default}}<mj-text>Thanks</mj-text>{{/slot:footer:default}}';
    expect(roundtrip(s)).toBe(s);
  });

  test('round-trips an empty default slot (holds position)', () => {
    const s = '{{#slot:body:default}}{{/slot:body:default}}';
    expect(roundtrip(s)).toBe(s);
  });
});

describe('decompose — template use (refs, no bodies)', () => {
  test('bare ref → kept, attributed to caller, no component write', () => {
    const r = decompose('a{{#component:footer}}{{/component:footer}}b', noCascade);
    expect(r.mjml).toBe('a{{#component:footer}}{{/component:footer}}b');
    expect(r.refs).toEqual(['footer']);
    expect(r.writes).toEqual([]);
  });

  test('ref with an override slot → override stays inline on the caller, no write', () => {
    const src = '{{#component:card}}{{#slot:header}}<mj-text>Hi</mj-text>{{/slot:header}}{{/component:card}}';
    const r = decompose(src, noCascade);
    expect(r.mjml).toBe(src);
    expect(r.refs).toEqual(['card']);
    expect(r.writes).toEqual([]);
  });

  test('a component ref INSIDE an override attributes to the caller, not the wrapper', () => {
    const src =
      '{{#component:card}}{{#slot:body}}{{#component:promo}}{{/component:promo}}{{/slot:body}}{{/component:card}}';
    const r = decompose(src, noCascade);
    // both card and promo are the caller's refs — promo rode in on the caller-supplied fill
    expect(r.refs.sort()).toEqual(['card', 'promo']);
    expect(r.writes).toEqual([]);
  });
});

describe('decompose — component edit (body present)', () => {
  test('new component body (no cascade) → one write with body + owned refs', () => {
    const body = '<mj-section><mj-column>{{#slot:body:default}}<mj-text>d</mj-text>{{/slot:body:default}}</mj-column></mj-section>';
    const src = `{{#component:cta}}${body}{{/component:cta}}`;
    const r = decompose(src, noCascade);
    // caller keeps a bare ref (body stripped out to its own row)
    expect(r.mjml).toBe('{{#component:cta}}{{/component:cta}}');
    expect(r.refs).toEqual(['cta']);
    expect(r.writes).toHaveLength(1);
    expect(r.writes[0].slug).toBe('cta');
    expect(r.writes[0].mjml).toBe(body);
    expect(r.writes[0].refs).toEqual([]);
  });

  test('body equals cascade → noop (no write)', () => {
    const body = '<mj-section>{{#slot:x:default}}{{/slot:x:default}}</mj-section>';
    const src = `{{#component:cta}}${body}{{/component:cta}}`;
    const r = decompose(src, (slug) => (slug === 'cta' ? body : undefined));
    expect(r.writes).toEqual([]);
    expect(r.refs).toEqual(['cta']);
  });

  test('body diverges from cascade → shadow write of the new body', () => {
    const stored = '<mj-section>{{#slot:x:default}}<mj-text>old</mj-text>{{/slot:x:default}}</mj-section>';
    const edited = '<mj-section>{{#slot:x:default}}<mj-text>new</mj-text>{{/slot:x:default}}</mj-section>';
    const src = `{{#component:cta}}${edited}{{/component:cta}}`;
    const r = decompose(src, (slug) => (slug === 'cta' ? stored : undefined));
    expect(r.writes).toHaveLength(1);
    expect(r.writes[0].mjml).toBe(edited);
  });
});

describe('decompose — nesting regression (parent ships a child pre-filled)', () => {
  const src =
    '{{#component:hero}}' +
    '{{#slot:body:default}}' +
    '{{#component:cta}}{{#slot:label}}Get started{{/slot:label}}{{/component:cta}}' +
    '{{/slot:body:default}}' +
    '{{/component:hero}}';

  test('cta is owned by hero (ref in hero default); label override lives in hero body; cta not written', () => {
    const r = decompose(src, noCascade);
    // top level: bare hero ref, hero owned by the caller
    expect(r.mjml).toBe('{{#component:hero}}{{/component:hero}}');
    expect(r.refs).toEqual(['hero']);
    // hero is written (new); its body owns cta and carries the label override verbatim
    expect(r.writes).toHaveLength(1);
    const hero = r.writes[0];
    expect(hero.slug).toBe('hero');
    expect(hero.refs).toEqual(['cta']);
    expect(hero.mjml).toBe(
      '{{#slot:body:default}}{{#component:cta}}{{#slot:label}}Get started{{/slot:label}}{{/component:cta}}{{/slot:body:default}}',
    );
    // cta itself carries no body here → no write
    expect(r.writes.find((w) => w.slug === 'cta')).toBeUndefined();
  });
});

describe('decompose — write ordering', () => {
  test('children are written before parents (FK-safe, depth-first)', () => {
    // editing hero, whose default body inlines a diverged child `panel` body
    const panelBody = '<mj-section>{{#slot:p:default}}<mj-text>p</mj-text>{{/slot:p:default}}</mj-section>';
    const heroBody =
      `{{#slot:body:default}}{{#component:panel}}${panelBody}{{/component:panel}}{{/slot:body:default}}`;
    const src = `{{#component:hero}}${heroBody}{{/component:hero}}`;
    const r = decompose(src, noCascade);
    const slugs = r.writes.map((w) => w.slug);
    expect(slugs).toEqual(['panel', 'hero']);
    // hero's stored body references panel as a bare ref (panel's body stripped to its own row)
    expect(r.writes[1].refs).toEqual(['panel']);
    expect(r.writes[1].mjml).toBe('{{#slot:body:default}}{{#component:panel}}{{/component:panel}}{{/slot:body:default}}');
  });
});
