import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables } from '@template/db/test';
import { decompose } from '@template/email/render/decompose';
import { EmailRenderError } from '@template/email/render/errors';
import { hydrate, hydrateCascade, type ResolveHydrateBodies } from '@template/email/render/hydrate';
import { lookupCascade } from '@template/email/render/lookupCascade';
import { saveEmailTemplate } from '@template/email/render/save';
import type { OwnerScope } from '@template/email/render/types';

const resolverFrom =
  (bodies: Record<string, string>): ResolveHydrateBodies =>
  async (slugs: string[]) =>
    Object.fromEntries(slugs.map((slug) => [slug, bodies[slug]]));

describe('hydrate', () => {
  test('returns plain content unchanged', async () => {
    expect(await hydrate('<mj-text>Hi</mj-text>', resolverFrom({}))).toBe('<mj-text>Hi</mj-text>');
  });

  test("inlines a bare ref's cascade body, preserving the body's own :default markers verbatim", async () => {
    const headerBody =
      '<mj-section><mj-column>{{#slot:greeting:default}}<mj-text>Welcome!</mj-text>{{/slot:greeting:default}}</mj-column></mj-section>';
    const hydrated = await hydrate('{{#component:header}}{{/component:header}}', resolverFrom({ header: headerBody }));

    expect(hydrated).toBe(`{{#component:header}}${headerBody}{{/component:header}}`);
  });

  test("recurses into a component nested inside another component's body", async () => {
    const hydrated = await hydrate(
      '{{#component:outer}}{{/component:outer}}',
      resolverFrom({
        outer: '<mj-text>Outer</mj-text>{{#component:inner}}{{/component:inner}}',
        inner: '<mj-text>Inner</mj-text>',
      }),
    );

    expect(hydrated).toBe(
      '{{#component:outer}}<mj-text>Outer</mj-text>{{#component:inner}}<mj-text>Inner</mj-text>{{/component:inner}}{{/component:outer}}',
    );
  });

  test('keeps an existing override in place, hydrated independently of the component body', async () => {
    const hydrated = await hydrate(
      '{{#component:card}}{{#slot:body}}<mj-text>Override</mj-text>{{/slot:body}}{{/component:card}}',
      resolverFrom({ card: '<x>{{#slot:body:default}}Default{{/slot:body:default}}</x>' }),
    );

    expect(hydrated).toBe(
      '{{#component:card}}<x>{{#slot:body:default}}Default{{/slot:body:default}}</x>{{#slot:body}}<mj-text>Override</mj-text>{{/slot:body}}{{/component:card}}',
    );
  });

  test('recurses into a component ref sitting inside an override', async () => {
    const hydrated = await hydrate(
      '{{#component:card}}{{#slot:body}}{{#component:promo}}{{/component:promo}}{{/slot:body}}{{/component:card}}',
      resolverFrom({
        card: '<x>{{#slot:body:default}}D{{/slot:body:default}}</x>',
        promo: '<mj-text>Promo</mj-text>',
      }),
    );

    expect(hydrated).toBe(
      '{{#component:card}}<x>{{#slot:body:default}}D{{/slot:body:default}}</x>{{#slot:body}}{{#component:promo}}<mj-text>Promo</mj-text>{{/component:promo}}{{/slot:body}}{{/component:card}}',
    );
  });

  test('a dangling ref (cascade can no longer resolve the slug) hydrates to an unchanged bare ref, no throw', async () => {
    const stored = '{{#component:gone}}{{/component:gone}}';
    expect(await hydrate(stored, resolverFrom({}))).toBe(stored);
  });

  test('an empty default holds position in the hydrated output', async () => {
    const hydrated = await hydrate(
      '{{#component:card}}{{/component:card}}',
      resolverFrom({ card: '<x>{{#slot:body:default}}{{/slot:body:default}}</x>' }),
    );
    expect(hydrated).toBe('{{#component:card}}<x>{{#slot:body:default}}{{/slot:body:default}}</x>{{/component:card}}');
  });
});

describe('hydrate + decompose round-trip: decompose(hydrate(row)) → zero writes, same mjml', () => {
  const roundTrips =
    (stored: string, resolve: ResolveHydrateBodies, cascadeBodies: Record<string, string>) => async () => {
      const hydrated = await hydrate(stored, resolve);
      const result = decompose(hydrated, (slug) => cascadeBodies[slug]);

      expect(result.writes).toEqual([]);
      expect(result.mjml).toBe(stored);
    };

  test('bare ref, no components', roundTrips('<mj-text>Hello</mj-text>', resolverFrom({}), {}));

  test(
    'single component ref',
    roundTrips(
      '{{#component:header}}{{/component:header}}',
      resolverFrom({
        header:
          '<mj-section><mj-column>{{#slot:greeting:default}}<mj-text>Welcome!</mj-text>{{/slot:greeting:default}}</mj-column></mj-section>',
      }),
      {
        header:
          '<mj-section><mj-column>{{#slot:greeting:default}}<mj-text>Welcome!</mj-text>{{/slot:greeting:default}}</mj-column></mj-section>',
      },
    ),
  );

  test(
    'nested components (parent owns child in its default)',
    roundTrips(
      '{{#component:hero}}{{/component:hero}}',
      resolverFrom({
        hero: '{{#slot:body:default}}{{#component:cta}}{{/component:cta}}{{/slot:body:default}}',
        cta: '<btn>Go</btn>',
      }),
      {
        hero: '{{#slot:body:default}}{{#component:cta}}{{/component:cta}}{{/slot:body:default}}',
        cta: '<btn>Go</btn>',
      },
    ),
  );

  test(
    'ref with a caller override (override rides through unchanged)',
    roundTrips(
      '{{#component:card}}{{#slot:body}}<mj-text>Custom</mj-text>{{/slot:body}}{{/component:card}}',
      resolverFrom({ card: '<x>{{#slot:body:default}}Default{{/slot:body:default}}</x>' }),
      { card: '<x>{{#slot:body:default}}Default{{/slot:body:default}}</x>' },
    ),
  );

  test(
    'a component ref nested inside an override (attributes to the caller, not the wrapper)',
    roundTrips(
      '{{#component:card}}{{#slot:body}}{{#component:promo}}{{/component:promo}}{{/slot:body}}{{/component:card}}',
      resolverFrom({ card: '<x>{{#slot:body:default}}D{{/slot:body:default}}</x>', promo: '<mj-text>Promo</mj-text>' }),
      { card: '<x>{{#slot:body:default}}D{{/slot:body:default}}</x>', promo: '<mj-text>Promo</mj-text>' },
    ),
  );

  test(
    'multiple sibling refs, one with an empty default',
    roundTrips(
      '{{#component:a}}{{/component:a}}{{#component:b}}{{/component:b}}',
      resolverFrom({
        a: '<mj-text>A</mj-text>',
        b: '{{#slot:x:default}}{{/slot:x:default}}',
      }),
      {
        a: '<mj-text>A</mj-text>',
        b: '{{#slot:x:default}}{{/slot:x:default}}',
      },
    ),
  );
});

describe('hydrate — bare inline content under a ref is not duplicated', () => {
  test('drops bare inline content under a ref and inlines only the cascade body', async () => {
    const hydrated = await hydrate(
      '{{#component:cta}}<mj-button>Loose copy</mj-button>{{/component:cta}}',
      resolverFrom({ cta: '<mj-button>Canonical</mj-button>' }),
    );
    expect(hydrated).toBe('{{#component:cta}}<mj-button>Canonical</mj-button>{{/component:cta}}');
  });

  test('round-trip of a bare-inline-content row produces zero writes (no corruption persisted)', async () => {
    const stored = '{{#component:cta}}<mj-button>Loose copy</mj-button>{{/component:cta}}';
    const cascade = { cta: '<mj-button>Canonical</mj-button>' };
    const hydrated = await hydrate(stored, resolverFrom(cascade));
    const result = decompose(hydrated, (slug) => cascade[slug as keyof typeof cascade]);

    expect(result.writes).toEqual([]);
    expect(result.mjml).toBe('{{#component:cta}}{{/component:cta}}');
  });
});

describe('hydrate — un-suffixed body slots are normalized to :default', () => {
  test("marks a component body's own un-suffixed slot :default so it is not read back as an override", async () => {
    const hydrated = await hydrate(
      '{{#component:card}}{{/component:card}}',
      resolverFrom({ card: '<x>{{#slot:cta}}<btn>D</btn>{{/slot:cta}}</x>' }),
    );
    expect(hydrated).toBe(
      '{{#component:card}}<x>{{#slot:cta:default}}<btn>D</btn>{{/slot:cta:default}}</x>{{/component:card}}',
    );
  });

  test('a legacy un-suffixed stored body normalizes (slot preserved), it does not amputate', async () => {
    const stored = '{{#component:card}}{{/component:card}}';
    const cascade = { card: '<x>{{#slot:cta}}<btn>D</btn>{{/slot:cta}}</x>' };
    const hydrated = await hydrate(stored, resolverFrom(cascade));
    const result = decompose(hydrated, (slug) => cascade[slug as keyof typeof cascade]);

    for (const write of result.writes) {
      expect(write.mjml).toContain('{{#slot:cta:default}}<btn>D</btn>{{/slot:cta:default}}');
      expect(write.mjml).not.toBe('<x></x>');
    }
  });
});

describe('hydrate — persisted cycles are bounded', () => {
  test('throws a typed circular_ref instead of recursing forever on a → b → a', async () => {
    const cyclic = resolverFrom({
      'cycle-a': '{{#component:cycle-b}}{{/component:cycle-b}}',
      'cycle-b': '{{#component:cycle-a}}{{/component:cycle-a}}',
    });
    await expect(hydrate('{{#component:cycle-a}}{{/component:cycle-a}}', cyclic)).rejects.toMatchObject({
      name: 'EmailRenderError',
      type: 'circular_ref',
    });
  });

  test('a self-referential body is caught too', async () => {
    const selfRef = resolverFrom({ loop: '{{#component:loop}}{{/component:loop}}' });
    await expect(hydrate('{{#component:loop}}{{/component:loop}}', selfRef)).rejects.toBeInstanceOf(EmailRenderError);
  });

  test('a component nested inside its OWN override slot is NOT a cycle (caller-path attribution)', async () => {
    const hydrated = await hydrate(
      '{{#component:card}}{{#slot:body}}{{#component:card}}{{/component:card}}{{/slot:body}}{{/component:card}}',
      resolverFrom({ card: '<x>{{#slot:body:default}}D{{/slot:body:default}}</x>' }),
    );
    expect(hydrated).toContain('{{#slot:body}}');
  });
});

describe('hydrateCascade (DB-backed)', () => {
  const mjml = (content: string) =>
    `<mjml><mj-body><mj-section><mj-column>${content}</mj-column></mj-section></mj-body></mjml>`;
  const ctx: OwnerScope = { ownerModel: 'default', locale: 'en' };

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  beforeEach(async () => {
    await db.emailComponent.deleteMany({});
    await db.emailTemplate.deleteMany({});
  });

  test("inlines a saved component's body through the real cascade lookup", async () => {
    const { template } = await saveEmailTemplate({
      slug: 'hydrate-header',
      name: 'Hydrate Header',
      subject: 'Hello',
      kind: 'system',
      mjml: mjml('{{#component:hydrate-header-cmp}}<mj-text>Header</mj-text>{{/component:hydrate-header-cmp}}'),
      ownerModel: 'default',
    });

    const hydrated = await hydrateCascade(template.mjml, ctx);
    expect(hydrated).toContain(
      '{{#component:hydrate-header-cmp}}<mj-text>Header</mj-text>{{/component:hydrate-header-cmp}}',
    );
  });

  test('round-trips through a real save: decompose(hydrateCascade(row)) produces zero writes', async () => {
    const { template } = await saveEmailTemplate({
      slug: 'hydrate-roundtrip',
      name: 'Hydrate Roundtrip',
      subject: 'Hello',
      kind: 'system',
      mjml: mjml('{{#component:roundtrip-cmp}}<mj-text>Body</mj-text>{{/component:roundtrip-cmp}}'),
      ownerModel: 'default',
    });

    const hydrated = await hydrateCascade(template.mjml, ctx);
    const existing = await lookupCascade(['roundtrip-cmp'], ctx);
    const result = decompose(hydrated, (slug) => existing[slug]?.mjml);

    expect(result.writes).toEqual([]);
    expect(result.mjml).toBe(template.mjml);
  });
});
