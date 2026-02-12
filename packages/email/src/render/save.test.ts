import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, createEmailComponent, createOrganization, createSpace } from '@template/db/test';
import { MjmlValidationError } from '@template/email/validations/MjmlValidationError';
import { saveEmailTemplate } from '@template/email/render/save';

/** Wrap content in valid MJML structure */
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
      category: 'system',
      mjml: mjml('<mj-text>Hello</mj-text>'),
      ownerModel: 'default',
    });

    expect(result.template.slug).toBe('simple');
    expect(result.template.componentRefs).toEqual([]);
    expect(result.components).toEqual([]);
  });

  it('saves template and extracts components', async () => {
    const result = await saveEmailTemplate({
      slug: 'with-header',
      name: 'With Header',
      subject: 'Hello',
      category: 'system',
      mjml: mjml('{{#component:header}}<mj-text>Header</mj-text>{{/component:header}}<mj-text>Body</mj-text>'),
      ownerModel: 'default',
    });

    expect(result.template.slug).toBe('with-header');
    expect(result.template.componentRefs).toEqual(['header']);
    expect(result.components.length).toBe(1);
    expect(result.components[0].slug).toBe('header');
  });

  it('deduplicates identical component content', async () => {
    const result = await saveEmailTemplate({
      slug: 'dup-header',
      name: 'Dup Header',
      subject: 'Hello',
      category: 'system',
      mjml: mjml(
        '{{#component:header}}<mj-text>Same</mj-text>{{/component:header}}{{#component:header}}<mj-text>Same</mj-text>{{/component:header}}',
      ),
      ownerModel: 'default',
    });

    expect(result.components.length).toBe(1);
    expect(result.template.componentRefs).toEqual(['header']);
  });

  it('creates variants for different content with same slug', async () => {
    const result = await saveEmailTemplate({
      slug: 'variants',
      name: 'Variants',
      subject: 'Hello',
      category: 'system',
      mjml: mjml(
        '{{#component:header}}<mj-text>Version A</mj-text>{{/component:header}}{{#component:header}}<mj-text>Version B</mj-text>{{/component:header}}',
      ),
      ownerModel: 'default',
    });

    expect(result.components.length).toBe(2);
    const slugs = result.components.map((c) => c.slug).sort();
    expect(slugs).toEqual(['header', 'header-1']);
  });

  it('matches existing component and keeps slug', async () => {
    await createEmailComponent({
      slug: 'footer',
      mjml: '<mj-text>Existing Footer</mj-text>',
      ownerModel: 'default',
    });

    const result = await saveEmailTemplate({
      slug: 'use-existing',
      name: 'Use Existing',
      subject: 'Hello',
      category: 'system',
      mjml: mjml('{{#component:footer}}<mj-text>Existing Footer</mj-text>{{/component:footer}}'),
      ownerModel: 'default',
    });

    expect(result.components.length).toBe(1);
    expect(result.components[0].slug).toBe('footer');
  });

  it('creates variant when content differs from existing', async () => {
    await createEmailComponent({
      slug: 'cta',
      mjml: '<mj-button href="#">Old CTA</mj-button>',
      ownerModel: 'default',
    });

    const result = await saveEmailTemplate({
      slug: 'new-cta',
      name: 'New CTA',
      subject: 'Hello',
      category: 'system',
      mjml: mjml('{{#component:cta}}<mj-button href="#">New CTA</mj-button>{{/component:cta}}'),
      ownerModel: 'default',
    });

    expect(result.components.length).toBe(1);
    expect(result.components[0].slug).toBe('cta-1');
  });

  it('respects ownership cascade - org inherits from default', async () => {
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
      category: 'system',
      mjml: mjml('{{#component:shared}}<mj-text>Default Content</mj-text>{{/component:shared}}'),
      ownerModel: 'Organization',
      organizationId: org.id,
    });

    expect(result.components[0].slug).toBe('shared');
    expect(result.components[0].ownerModel).toBe('Organization');
  });

  it('handles nested components', async () => {
    const result = await saveEmailTemplate({
      slug: 'nested',
      name: 'Nested',
      subject: 'Hello',
      category: 'system',
      mjml: mjml(
        '{{#component:outer}}<mj-text>Outer {{#component:inner}}<mj-text>Inner</mj-text>{{/component:inner}}</mj-text>{{/component:outer}}',
      ),
      ownerModel: 'default',
    });

    expect(result.components.length).toBe(2);
    const outer = result.components.find((c) => c.slug === 'outer');
    expect(outer?.componentRefs).toEqual(['inner']);
  });

  // === Ownership cascade tests ===

  it('admin template - no cascade', async () => {
    const result = await saveEmailTemplate({
      slug: 'admin-only',
      name: 'Admin Only',
      subject: 'Hello',
      category: 'system',
      mjml: mjml('<mj-text>Admin</mj-text>'),
      ownerModel: 'admin',
    });

    expect(result.template.ownerModel).toBe('admin');
  });

  it('space inherits from existing space component', async () => {
    const { entity: org } = await createOrganization();
    const { entity: space } = await createSpace({ organizationId: org.id });

    await createEmailComponent({
      slug: 'space-header',
      mjml: '<mj-text>Space Header</mj-text>',
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: space.id,
    });

    const result = await saveEmailTemplate({
      slug: 'space-template',
      name: 'Space Template',
      subject: 'Hello',
      category: 'system',
      mjml: mjml('{{#component:space-header}}<mj-text>Space Header</mj-text>{{/component:space-header}}'),
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: space.id,
    });

    expect(result.components[0].slug).toBe('space-header');
    expect(result.components[0].ownerModel).toBe('Space');
  });

  it('space inherits from org component when inheritToSpaces is true', async () => {
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
      category: 'system',
      mjml: mjml('{{#component:org-shared}}<mj-text>Org Shared</mj-text>{{/component:org-shared}}'),
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: space.id,
    });

    expect(result.components[0].slug).toBe('org-shared');
  });

  it('space does not inherit from org component when inheritToSpaces is false', async () => {
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
      category: 'system',
      mjml: mjml('{{#component:org-private}}<mj-text>Org Private</mj-text>{{/component:org-private}}'),
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: space.id,
    });

    // Should create new component since org-private is not inherited
    expect(result.components[0].slug).toBe('org-private');
    expect(result.components[0].ownerModel).toBe('Space');
  });

  it('space inherits from default', async () => {
    const { entity: org } = await createOrganization();
    const { entity: space } = await createSpace({ organizationId: org.id });

    await createEmailComponent({
      slug: 'default-footer',
      mjml: '<mj-text>Default Footer</mj-text>',
      ownerModel: 'default',
    });

    const result = await saveEmailTemplate({
      slug: 'space-uses-default',
      name: 'Space Uses Default',
      subject: 'Hello',
      category: 'system',
      mjml: mjml('{{#component:default-footer}}<mj-text>Default Footer</mj-text>{{/component:default-footer}}'),
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: space.id,
    });

    expect(result.components[0].slug).toBe('default-footer');
  });

  // === Validation tests ===

  it('throws MjmlValidationError for invalid MJML', async () => {
    await expect(
      saveEmailTemplate({
        slug: 'invalid',
        name: 'Invalid',
        subject: 'Hello',
        category: 'system',
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
        category: 'system',
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
