import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, createEmailComponent, createOrganization, createSpace } from '@template/db/test';
import { saveEmailTemplate } from '@template/email/render/save';
import { MjmlValidationError } from '@template/email/validations/MjmlValidationError';

const mjml = (content: string) =>
  `<mjml><mj-body><mj-section><mj-column>${content}</mj-column></mj-section></mj-body></mjml>`;

describe('saveEmailTemplate', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  beforeEach(async () => {
    await db.emailComponent.deleteMany({});
    await db.emailTemplate.deleteMany({});
  });

  it('saves template with no components', async () => {
    const result = await saveEmailTemplate({
      slug: 'simple',
      name: 'Simple Template',
      subject: 'Hello',
      kind: 'system',
      mjml: mjml('<mj-text>Hello</mj-text>'),
      ownerModel: 'default',
    });

    expect(result.template.slug).toBe('simple');
    expect(result.template.componentRefs).toEqual([]);
    expect(result.components).toEqual([]);
  });

  it('rejects a non-system template with no unsubscribe link', async () => {
    await expect(
      saveEmailTemplate({
        slug: 'promo-nolink',
        name: 'Promo',
        subject: 'News',
        kind: 'marketing',
        mjml: mjml('<mj-text>News</mj-text>'),
        ownerModel: 'default',
      }),
    ).rejects.toThrow(/unsubscribe/i);
  });

  it('accepts a non-system template with an unconditional unsubscribe link', async () => {
    const result = await saveEmailTemplate({
      slug: 'promo-link',
      name: 'Promo',
      subject: 'News',
      kind: 'marketing',
      mjml: mjml('<mj-text>News</mj-text><mj-text>{{system.unsubscribeUrl}}</mj-text>'),
      ownerModel: 'default',
    });
    expect(result.template.slug).toBe('promo-link');
  });

  it('rejects a non-system template whose only unsubscribe link is inside a conditional', async () => {
    const rule = '{"field":"recipient.role","operator":"equals","value":"admin"}';
    await expect(
      saveEmailTemplate({
        slug: 'promo-condlink',
        name: 'Promo',
        subject: 'News',
        kind: 'marketing',
        mjml: mjml(`<mj-text>News</mj-text>{{#if rule=${rule}}}<mj-text>{{system.unsubscribeUrl}}</mj-text>{{/if}}`),
        ownerModel: 'default',
      }),
    ).rejects.toThrow(/unconditional/i);
  });

  it('writes a component from an inlined body and leaves a bare ref on the template', async () => {
    const result = await saveEmailTemplate({
      slug: 'with-header',
      name: 'With Header',
      subject: 'Hello',
      kind: 'system',
      mjml: mjml('{{#component:header}}<mj-text>Header</mj-text>{{/component:header}}<mj-text>Body</mj-text>'),
      ownerModel: 'default',
    });

    expect(result.template.slug).toBe('with-header');
    expect(result.template.componentRefs).toEqual(['header']);
    expect(result.components.length).toBe(1);
    expect(result.components[0].slug).toBe('header');
    expect(result.components[0].mjml).toBe('<mj-text>Header</mj-text>');
  });

  it('rejects a component whose body is a full MJML document, not a fragment', async () => {
    await expect(
      saveEmailTemplate({
        slug: 'doc-component',
        name: 'Doc Component',
        subject: 'Hello',
        kind: 'system',
        mjml: mjml('{{#component:whole}}<mjml><mj-body><mj-text>Nope</mj-text></mj-body></mjml>{{/component:whole}}'),
        ownerModel: 'default',
      }),
    ).rejects.toThrow(MjmlValidationError);
  });

  it('rejects a component whose body is not valid MJML in any fragment context', async () => {
    await expect(
      saveEmailTemplate({
        slug: 'bad-frag',
        name: 'Bad Fragment',
        subject: 'Hello',
        kind: 'system',
        mjml: mjml('{{#component:broken}}<mj-not-a-real-tag>x</mj-not-a-real-tag>{{/component:broken}}'),
        ownerModel: 'default',
      }),
    ).rejects.toThrow();
  });

  it('collapses repeated identical inline bodies to one component', async () => {
    const result = await saveEmailTemplate({
      slug: 'dup-header',
      name: 'Dup Header',
      subject: 'Hello',
      kind: 'system',
      mjml: mjml(
        '{{#component:header}}<mj-text>Same</mj-text>{{/component:header}}{{#component:header}}<mj-text>Same</mj-text>{{/component:header}}',
      ),
      ownerModel: 'default',
    });

    expect(result.components.length).toBe(1);
    expect(result.template.componentRefs).toEqual(['header']);
  });

  it('does not variant-fork: a slug is one component, last inline body wins', async () => {
    // Under the cascade-diff model there is no slug:idx variant. Two different inline bodies for the
    // same slug in one payload collapse to a single component row (no `header-1`).
    const result = await saveEmailTemplate({
      slug: 'no-variants',
      name: 'No Variants',
      subject: 'Hello',
      kind: 'system',
      mjml: mjml(
        '{{#component:header}}<mj-text>Version A</mj-text>{{/component:header}}{{#component:header}}<mj-text>Version B</mj-text>{{/component:header}}',
      ),
      ownerModel: 'default',
    });

    expect(result.components.map((c) => c.slug)).toEqual(['header']);
    expect(result.components[0].mjml).toBe('<mj-text>Version B</mj-text>');
  });

  it('an inline body equal to the cascade is a noop (inherits, no write)', async () => {
    await createEmailComponent({
      slug: 'footer',
      mjml: '<mj-text>Existing Footer</mj-text>',
      ownerModel: 'default',
    });

    const result = await saveEmailTemplate({
      slug: 'use-existing',
      name: 'Use Existing',
      subject: 'Hello',
      kind: 'system',
      mjml: mjml('{{#component:footer}}<mj-text>Existing Footer</mj-text>{{/component:footer}}'),
      ownerModel: 'default',
    });

    expect(result.components).toEqual([]);
    expect(result.template.componentRefs).toEqual(['footer']);
  });

  it('a bare ref (no inlined body) writes nothing and just references the component', async () => {
    await createEmailComponent({
      slug: 'footer',
      mjml: '<mj-text>Existing Footer</mj-text>',
      ownerModel: 'default',
    });

    const result = await saveEmailTemplate({
      slug: 'bare-ref',
      name: 'Bare Ref',
      subject: 'Hello',
      kind: 'system',
      mjml: mjml('{{#component:footer}}{{/component:footer}}'),
      ownerModel: 'default',
    });

    expect(result.components).toEqual([]);
    expect(result.template.componentRefs).toEqual(['footer']);
  });

  it('a divergent inline body writes the SAME slug (shadow, no variant suffix)', async () => {
    await createEmailComponent({
      slug: 'cta',
      mjml: '<mj-button href="#">Old CTA</mj-button>',
      ownerModel: 'default',
    });

    const result = await saveEmailTemplate({
      slug: 'new-cta',
      name: 'New CTA',
      subject: 'Hello',
      kind: 'system',
      mjml: mjml('{{#component:cta}}<mj-button href="#">New CTA</mj-button>{{/component:cta}}'),
      ownerModel: 'default',
    });

    expect(result.components.length).toBe(1);
    expect(result.components[0].slug).toBe('cta');
    expect(result.components[0].mjml).toBe('<mj-button href="#">New CTA</mj-button>');
  });

  it('unchanged inline body inherits from default — no shadow written at the org tier', async () => {
    const { entity: org } = await createOrganization();

    await createEmailComponent({
      slug: 'shared',
      mjml: '<mj-text>Default Content</mj-text>',
      ownerModel: 'default',
    });

    const result = await saveEmailTemplate({
      slug: 'org-template',
      name: 'Org Template',
      subject: 'Hello',
      kind: 'system',
      mjml: mjml('{{#component:shared}}<mj-text>Default Content</mj-text>{{/component:shared}}'),
      ownerModel: 'Organization',
      organizationId: org.id,
    });

    expect(result.components).toEqual([]);
    expect(result.template.componentRefs).toEqual(['shared']);
  });

  it('a divergent inline body shadows the default at the org tier (same slug)', async () => {
    const { entity: org } = await createOrganization();

    await createEmailComponent({
      slug: 'shared',
      mjml: '<mj-text>Default Content</mj-text>',
      ownerModel: 'default',
    });

    const result = await saveEmailTemplate({
      slug: 'org-shadow',
      name: 'Org Shadow',
      subject: 'Hello',
      kind: 'system',
      mjml: mjml('{{#component:shared}}<mj-text>Org Content</mj-text>{{/component:shared}}'),
      ownerModel: 'Organization',
      organizationId: org.id,
    });

    expect(result.components.length).toBe(1);
    expect(result.components[0].slug).toBe('shared');
    expect(result.components[0].ownerModel).toBe('Organization');
    expect(result.components[0].mjml).toBe('<mj-text>Org Content</mj-text>');
  });

  it('handles nested components — a ref inside a component body is owned by that component', async () => {
    const result = await saveEmailTemplate({
      slug: 'nested',
      name: 'Nested',
      subject: 'Hello',
      kind: 'system',
      mjml: mjml(
        '{{#component:outer}}<mj-text>Outer {{#component:inner}}<mj-text>Inner</mj-text>{{/component:inner}}</mj-text>{{/component:outer}}',
      ),
      ownerModel: 'default',
    });

    expect(result.components.length).toBe(2);
    const outer = result.components.find((c) => c.slug === 'outer');
    expect(outer?.componentRefs).toEqual(['inner']);
  });

  it('admin template - no cascade', async () => {
    const result = await saveEmailTemplate({
      slug: 'admin-only',
      name: 'Admin Only',
      subject: 'Hello',
      kind: 'system',
      mjml: mjml('<mj-text>Admin</mj-text>'),
      ownerModel: 'admin',
    });

    expect(result.template.ownerModel).toBe('admin');
  });

  it('a component outside the tier cascade is written at the current tier', async () => {
    // inheritToSpaces=false means the org component is NOT in the space's cascade, so the inlined
    // body has no baseline to match → it is written at the Space tier.
    const { entity: org } = await createOrganization();
    const { entity: space } = await createSpace({ organizationId: org.id });

    await createEmailComponent({
      slug: 'org-private',
      mjml: '<mj-text>Org Private</mj-text>',
      ownerModel: 'Organization',
      organizationId: org.id,
      inheritToSpaces: false,
    });

    const result = await saveEmailTemplate({
      slug: 'space-no-inherit',
      name: 'Space No Inherit',
      subject: 'Hello',
      kind: 'system',
      mjml: mjml('{{#component:org-private}}<mj-text>Org Private</mj-text>{{/component:org-private}}'),
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: space.id,
    });

    expect(result.components.length).toBe(1);
    expect(result.components[0].slug).toBe('org-private');
    expect(result.components[0].ownerModel).toBe('Space');
  });

  it('unchanged inline body inherits an org component through inheritToSpaces (no space write)', async () => {
    const { entity: org } = await createOrganization();
    const { entity: space } = await createSpace({ organizationId: org.id });

    await createEmailComponent({
      slug: 'org-shared',
      mjml: '<mj-text>Org Shared</mj-text>',
      ownerModel: 'Organization',
      organizationId: org.id,
      inheritToSpaces: true,
    });

    const result = await saveEmailTemplate({
      slug: 'space-uses-org',
      name: 'Space Uses Org',
      subject: 'Hello',
      kind: 'system',
      mjml: mjml('{{#component:org-shared}}<mj-text>Org Shared</mj-text>{{/component:org-shared}}'),
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: space.id,
    });

    expect(result.components).toEqual([]);
    expect(result.template.componentRefs).toEqual(['org-shared']);
  });

  it('throws MjmlValidationError for invalid MJML', async () => {
    await expect(
      saveEmailTemplate({
        slug: 'invalid',
        name: 'Invalid',
        subject: 'Hello',
        kind: 'system',
        mjml: '<mjml><mj-body><mj-invalid-tag>Bad</mj-invalid-tag></mj-body></mjml>',
        ownerModel: 'default',
      }),
    ).rejects.toBeInstanceOf(MjmlValidationError);
  });

  it('MjmlValidationError contains issues array', async () => {
    try {
      await saveEmailTemplate({
        slug: 'invalid2',
        name: 'Invalid2',
        subject: 'Hello',
        kind: 'system',
        mjml: '<mjml><mj-body><mj-unknown>Bad</mj-unknown></mj-body></mjml>',
        ownerModel: 'default',
      });
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(MjmlValidationError);
      expect((err as MjmlValidationError).issues.length).toBeGreaterThan(0);
    }
  });
});
