import { describe, it, expect, afterAll, beforeEach } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, createEmailComponent, createEmailTemplate, createOrganization } from '@template/db/test';
import { composeTemplate, composeComponent } from './compose';
import { EmailRenderError } from './errors';

describe('composeTemplate', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  beforeEach(async () => {
    await db.emailComponent.deleteMany({});
    await db.emailTemplate.deleteMany({});
  });

  it('composes template with no components', async () => {
    await createEmailTemplate({
      slug: 'simple',
      name: 'Simple',
      subject: 'Hello {{recipient.name}}',
      category: 'system',
      mjml: '<mjml><mj-body><mj-text>Hello</mj-text></mj-body></mjml>',
      componentRefs: [],
      ownerModel: 'default',
    });

    const result = await composeTemplate('simple', {
      ownerModel: 'default',
      locale: 'en',
    });

    expect(result.mjml).toContain('<mj-text>Hello</mj-text>');
    expect(result.subject).toBe('Hello {{recipient.name}}');
    expect(result.category).toBe('system');
  });

  it('composes template with single component', async () => {
    await createEmailComponent({
      slug: 'header',
      mjml: '<mj-section><mj-text>Header Content</mj-text></mj-section>',
      ownerModel: 'default',
    });

    await createEmailTemplate({
      slug: 'with-header',
      name: 'With Header',
      subject: 'Test',
      category: 'system',
      mjml: '<mjml><mj-body>{{#component:header}}{{/component:header}}<mj-text>Body</mj-text></mj-body></mjml>',
      componentRefs: ['header'],
      ownerModel: 'default',
    });

    const result = await composeTemplate('with-header', {
      ownerModel: 'default',
      locale: 'en',
    });

    expect(result.mjml).toContain('<mj-text>Header Content</mj-text>');
    expect(result.mjml).toContain('<mj-text>Body</mj-text>');
    expect(result.mjml).not.toContain('{{#component');
  });

  it('composes template with nested components', async () => {
    await createEmailComponent({
      slug: 'logo',
      mjml: '<mj-image src="logo.png" />',
      componentRefs: [],
      ownerModel: 'default',
    });

    await createEmailComponent({
      slug: 'header',
      mjml: '<mj-section>{{#component:logo}}{{/component:logo}}<mj-text>Nav</mj-text></mj-section>',
      componentRefs: ['logo'],
      ownerModel: 'default',
    });

    await createEmailTemplate({
      slug: 'nested',
      name: 'Nested',
      subject: 'Test',
      category: 'system',
      mjml: '<mjml><mj-body>{{#component:header}}{{/component:header}}</mj-body></mjml>',
      componentRefs: ['header'],
      ownerModel: 'default',
    });

    const result = await composeTemplate('nested', {
      ownerModel: 'default',
      locale: 'en',
    });

    expect(result.mjml).toContain('<mj-image src="logo.png" />');
    expect(result.mjml).toContain('<mj-text>Nav</mj-text>');
    expect(result.mjml).not.toContain('{{#component');
  });

  it('throws on missing template with descriptive error', async () => {
    try {
      await composeTemplate('nonexistent', { ownerModel: 'default', locale: 'en' });
      expect(true).toBe(false); // Should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(EmailRenderError);
      const e = err as EmailRenderError;
      expect(e.type).toBe('template_missing');
      expect(e.slug).toBe('nonexistent');
      expect(e.message).toBe('Template not found: nonexistent');
    }
  });

  it('throws on missing component with descriptive error', async () => {
    await createEmailTemplate({
      slug: 'missing-ref',
      name: 'Missing Ref',
      subject: 'Test',
      category: 'system',
      mjml: '<mjml><mj-body>{{#component:missing}}{{/component:missing}}</mj-body></mjml>',
      componentRefs: ['missing'],
      ownerModel: 'default',
    });

    try {
      await composeTemplate('missing-ref', { ownerModel: 'default', locale: 'en' });
      expect(true).toBe(false); // Should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(EmailRenderError);
      const e = err as EmailRenderError;
      expect(e.type).toBe('component_missing');
      expect(e.slug).toBe('missing');
      expect(e.message).toBe('Component not found: missing');
    }
  });

  it('respects ownership cascade - org gets org component', async () => {
    const { entity: org } = await createOrganization();

    await createEmailComponent({
      slug: 'header',
      mjml: '<mj-text>Default Header</mj-text>',
      ownerModel: 'default',
    });

    await createEmailComponent({
      slug: 'header',
      mjml: '<mj-text>Org Header</mj-text>',
      ownerModel: 'Organization',
      organizationId: org.id,
    });

    await createEmailTemplate({
      slug: 'org-template',
      name: 'Org Template',
      subject: 'Test',
      category: 'system',
      mjml: '<mjml><mj-body>{{#component:header}}{{/component:header}}</mj-body></mjml>',
      componentRefs: ['header'],
      ownerModel: 'Organization',
      organizationId: org.id,
    });

    const result = await composeTemplate('org-template', {
      ownerModel: 'Organization',
      organizationId: org.id,
      locale: 'en',
    });

    expect(result.mjml).toContain('Org Header');
    expect(result.mjml).not.toContain('Default Header');
  });

  it('respects ownership cascade - org falls back to default', async () => {
    const { entity: org } = await createOrganization();

    await createEmailComponent({
      slug: 'footer',
      mjml: '<mj-text>Default Footer</mj-text>',
      ownerModel: 'default',
    });

    await createEmailTemplate({
      slug: 'fallback-template',
      name: 'Fallback',
      subject: 'Test',
      category: 'system',
      mjml: '<mjml><mj-body>{{#component:footer}}{{/component:footer}}</mj-body></mjml>',
      componentRefs: ['footer'],
      ownerModel: 'Organization',
      organizationId: org.id,
    });

    const result = await composeTemplate('fallback-template', {
      ownerModel: 'Organization',
      organizationId: org.id,
      locale: 'en',
    });

    expect(result.mjml).toContain('Default Footer');
  });
});

describe('composeComponent', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  beforeEach(async () => {
    await db.emailComponent.deleteMany({});
  });

  it('composes standalone component', async () => {
    await createEmailComponent({
      slug: 'cta',
      mjml: '<mj-button href="#">Click</mj-button>',
      componentRefs: [],
      ownerModel: 'default',
    });

    const result = await composeComponent('cta', {
      ownerModel: 'default',
      locale: 'en',
    });

    expect(result.mjml).toContain('<mj-button href="#">Click</mj-button>');
  });

  it('composes component with nested refs', async () => {
    await createEmailComponent({
      slug: 'icon',
      mjml: '<mj-image src="icon.png" />',
      componentRefs: [],
      ownerModel: 'default',
    });

    await createEmailComponent({
      slug: 'button-with-icon',
      mjml: '<mj-section>{{#component:icon}}{{/component:icon}}<mj-button>Go</mj-button></mj-section>',
      componentRefs: ['icon'],
      ownerModel: 'default',
    });

    const result = await composeComponent('button-with-icon', {
      ownerModel: 'default',
      locale: 'en',
    });

    expect(result.mjml).toContain('<mj-image src="icon.png" />');
    expect(result.mjml).toContain('<mj-button>Go</mj-button>');
  });

  it('throws on missing component with descriptive error', async () => {
    try {
      await composeComponent('nonexistent', { ownerModel: 'default', locale: 'en' });
      expect(true).toBe(false); // Should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(EmailRenderError);
      const e = err as EmailRenderError;
      expect(e.type).toBe('component_missing');
      expect(e.slug).toBe('nonexistent');
      expect(e.message).toBe('Component not found: nonexistent');
    }
  });
});
