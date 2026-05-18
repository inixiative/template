import { afterAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { ContactType, TagResource, WebhookModel, WebhookOwnerModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createContact,
  createCustomerRef,
  createEmailComponent,
  createEmailTemplate,
  createOrganization,
  createSpace,
  createTag,
  createTagAttachment,
  createTagCategory,
  createUser,
  createWebhookSubscription,
  getNextSeq,
} from '@template/db/test';
import { registerContactRulesHook } from '#/hooks/contactRules/hook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { registerTagOwnerCategoryHook } from '#/hooks/tagOwnerCategory/hook';

// Register only the hooks that affect data shape during create — the rules
// hook (polymorphism), contactRules (computes valueKey), tagOwnerCategory
// (tag↔category check). We avoid registerHooks() because it also wires up
// the outbound webhook hook which signs payloads with PEM keys not present
// in the test env.
registerRulesHook();
registerContactRulesHook();
registerTagOwnerCategoryHook();

const seq = (prefix: string) => `${prefix}-${getNextSeq()}`;

describe('partial unique constraints', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  describe('Contact: per-(userId, type, valueKey)', () => {
    it('blocks two contacts with the same value on the same user', async () => {
      const { entity: user } = await createUser();
      const handle = seq('shared');
      await createContact(
        { ownerModel: 'User', type: ContactType.linkedin, value: { classifier: 'personal', handle } },
        { user },
      );
      const dupe = async () =>
        createContact(
          { ownerModel: 'User', type: ContactType.linkedin, value: { classifier: 'personal', handle } },
          { user },
        );
      await expect(dupe()).rejects.toThrow();
    });

    it('allows the same value on a different user', async () => {
      const { entity: a } = await createUser();
      const { entity: b } = await createUser();
      const handle = seq('cross-user');
      await createContact(
        { ownerModel: 'User', type: ContactType.linkedin, value: { classifier: 'personal', handle } },
        { user: a },
      );
      const second = await createContact(
        { ownerModel: 'User', type: ContactType.linkedin, value: { classifier: 'personal', handle } },
        { user: b },
      );
      expect(second.entity.userId).toBe(b.id);
    });
  });

  describe('TagAttachment: per-(userId, tagId)', () => {
    it('blocks two attachments of the same tag to the same user', async () => {
      const { entity: user } = await createUser();
      const cat = await createTagCategory({ ownerModel: TagResource.platform });
      const tag = await createTag(
        { name: seq('attach'), ownerModel: TagResource.platform, resources: [] },
        { tagCategory: cat.entity },
      );
      await createTagAttachment({ resourceModel: TagResource.User }, { user, tag: tag.entity });
      const dupe = async () => createTagAttachment({ resourceModel: TagResource.User }, { user, tag: tag.entity });
      await expect(dupe()).rejects.toThrow();
    });
  });

  describe('TagCategory: per-(userId, name) and platform-scoped name', () => {
    it('blocks two user-scoped categories with the same name on the same user', async () => {
      const { entity: user } = await createUser();
      const name = seq('audience');
      await createTagCategory({ name, ownerModel: TagResource.User }, { user });
      const dupe = async () => createTagCategory({ name, ownerModel: TagResource.User }, { user });
      await expect(dupe()).rejects.toThrow();
    });

    it('blocks two platform categories with the same name', async () => {
      const name = seq('global-cat');
      await createTagCategory({ name, ownerModel: TagResource.platform });
      const dupe = async () => createTagCategory({ name, ownerModel: TagResource.platform });
      await expect(dupe()).rejects.toThrow();
    });

    it('allows the same category name on different users', async () => {
      const { entity: a } = await createUser();
      const { entity: b } = await createUser();
      const name = seq('audience-cross');
      await createTagCategory({ name, ownerModel: TagResource.User }, { user: a });
      const second = await createTagCategory({ name, ownerModel: TagResource.User }, { user: b });
      expect(second.entity.userId).toBe(b.id);
    });
  });

  describe('Tag: per-(userId, tagCategoryId, name)', () => {
    it('blocks two tags with the same name in the same category for the same user', async () => {
      const { entity: user } = await createUser();
      const cat = await createTagCategory({ ownerModel: TagResource.User }, { user });
      const name = seq('dup-tag');
      await createTag({ name, ownerModel: TagResource.User, resources: [] }, { user, tagCategory: cat.entity });
      const dupe = async () =>
        createTag({ name, ownerModel: TagResource.User, resources: [] }, { user, tagCategory: cat.entity });
      await expect(dupe()).rejects.toThrow();
    });
  });

  describe('CustomerRef: per-(customer, provider)', () => {
    it('blocks two refs linking the same user customer to the same space provider', async () => {
      const { entity: customer } = await createUser();
      const { entity: org } = await createOrganization();
      const { entity: providerSpace } = await createSpace({}, { organization: org });
      // Pass relations in overrides (keyed by relation name) — context (ctx)
      // is keyed by depAccessor (lowerFirst(ModelName)), so it can't
      // disambiguate two FKs to the same model (e.g. customerSpace +
      // providerSpace both map to ctx.space).
      await createCustomerRef({
        customerModel: 'User',
        providerModel: 'Space',
        customerUser: customer,
        providerSpace,
      });
      const dupe = async () =>
        createCustomerRef({
          customerModel: 'User',
          providerModel: 'Space',
          customerUser: customer,
          providerSpace,
        });
      await expect(dupe()).rejects.toThrow();
    });
  });

  describe('WebhookSubscription: per-(userId, model, url)', () => {
    it('blocks two subscriptions with the same model+url on the same user', async () => {
      const { entity: user } = await createUser();
      const url = `https://example.com/${seq('hook')}`;
      await createWebhookSubscription(
        { ownerModel: WebhookOwnerModel.User, model: WebhookModel.CustomerRef, url },
        { user },
      );
      const dupe = async () =>
        createWebhookSubscription(
          { ownerModel: WebhookOwnerModel.User, model: WebhookModel.CustomerRef, url },
          { user },
        );
      await expect(dupe()).rejects.toThrow();
    });
  });

  describe('EmailComponent: platform / org / space partials', () => {
    it('blocks two components with the same (slug, locale) within ownerModel=default', async () => {
      const slug = seq('comp-default');
      await createEmailComponent({ slug, locale: 'en', ownerModel: 'default' });
      const dupe = async () => createEmailComponent({ slug, locale: 'en', ownerModel: 'default' });
      await expect(dupe()).rejects.toThrow();
    });

    it("allows the same (slug, locale) across 'default' and 'admin' (different ownerModel)", async () => {
      const slug = seq('comp-cross-platform');
      await createEmailComponent({ slug, locale: 'en', ownerModel: 'default' });
      const second = await createEmailComponent({ slug, locale: 'en', ownerModel: 'admin' });
      expect(second.entity.ownerModel).toBe('admin');
    });

    it('allows the same (slug, locale) across two different organizations', async () => {
      const { entity: org1 } = await createOrganization();
      const { entity: org2 } = await createOrganization();
      const slug = seq('comp-cross-org');
      await createEmailComponent({ slug, locale: 'en', ownerModel: 'Organization' }, { organization: org1 });
      const second = await createEmailComponent(
        { slug, locale: 'en', ownerModel: 'Organization' },
        { organization: org2 },
      );
      expect(second.entity.organizationId).toBe(org2.id);
    });
  });

  describe('EmailTemplate: platform / org / space partials', () => {
    it('blocks two templates with the same (slug, locale) within ownerModel=default', async () => {
      const slug = seq('tpl-default');
      await createEmailTemplate({ slug, locale: 'en', ownerModel: 'default' });
      const dupe = async () => createEmailTemplate({ slug, locale: 'en', ownerModel: 'default' });
      await expect(dupe()).rejects.toThrow();
    });

    it("allows the same (slug, locale) across 'default' and 'admin'", async () => {
      const slug = seq('tpl-cross-platform');
      await createEmailTemplate({ slug, locale: 'en', ownerModel: 'default' });
      const second = await createEmailTemplate({ slug, locale: 'en', ownerModel: 'admin' });
      expect(second.entity.ownerModel).toBe('admin');
    });
  });
});
