import { afterAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db, unregisterDbHook } from '@template/db';
import { TagOwnerModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganization,
  createTag,
  createTagCategory,
  createUser,
  getNextSeq,
} from '@template/db/test';
import { registerMemberSelfGrantHook } from '#/hooks/memberSelfGrant/hook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { registerTagOwnerCategoryHook } from '#/hooks/tagOwnerCategory/hook';

registerMemberSelfGrantHook();

registerRulesHook();
registerTagOwnerCategoryHook();

afterAll(async () => {
  await cleanupTouchedTables(db);
  clearHookRegistry();
});

const tagName = (prefix: string) => `${prefix}-${getNextSeq()}`;

describe('tagOwnerCategory hook', () => {
  it('allows a platform tag in a platform category', async () => {
    const cat = await createTagCategory({ ownerModel: TagOwnerModel.platform });
    const tag = await createTag(
      { name: tagName('platform-ok'), ownerModel: TagOwnerModel.platform, resources: [] },
      { tagCategory: cat.entity },
    );
    expect(tag.entity.ownerModel).toBe(TagOwnerModel.platform);
    expect(tag.entity.tagCategoryId).toBe(cat.entity.id);
  });

  it('allows a User tag in a matching User category', async () => {
    const { entity: user } = await createUser();
    const cat = await createTagCategory({ ownerModel: TagOwnerModel.User }, { user });
    const tag = await createTag(
      { name: tagName('user-ok'), ownerModel: TagOwnerModel.User, resources: [] },
      { user, tagCategory: cat.entity },
    );
    expect(tag.entity.userId).toBe(user.id);
  });

  it('rejects a User tag in a platform category (ownerModel mismatch)', async () => {
    const { entity: user } = await createUser();
    const cat = await createTagCategory({ ownerModel: TagOwnerModel.platform });
    const create = async () =>
      createTag(
        { name: tagName('mismatch-owner'), ownerModel: TagOwnerModel.User, resources: [] },
        { user, tagCategory: cat.entity },
      );
    await expect(create()).rejects.toThrow(/ownerModel/);
  });

  it('rejects a User tag whose userId differs from the User category', async () => {
    const { entity: a } = await createUser();
    const { entity: b } = await createUser();
    const cat = await createTagCategory({ ownerModel: TagOwnerModel.User }, { user: a });
    const create = async () =>
      createTag(
        { name: tagName('mismatch-fk'), ownerModel: TagOwnerModel.User, resources: [] },
        { user: b, tagCategory: cat.entity },
      );
    await expect(create()).rejects.toThrow(/userId/);
  });

  it('rejects updating a tag to mismatch its category', async () => {
    const { entity: a } = await createUser();
    const { entity: b } = await createUser();
    const cat = await createTagCategory({ ownerModel: TagOwnerModel.User }, { user: a });
    const tag = await createTag(
      { name: tagName('update-target'), ownerModel: TagOwnerModel.User, resources: [] },
      { user: a, tagCategory: cat.entity },
    );
    const update = async () =>
      db.tag.update({ where: { id: tag.entity.id }, data: { userId: b.id } });
    await expect(update()).rejects.toThrow(/userId/);
  });

  it('allows an Organization tag in a matching Organization category', async () => {
    const { entity: org } = await createOrganization();
    const cat = await createTagCategory(
      { ownerModel: TagOwnerModel.Organization },
      { organization: org },
    );
    const tag = await createTag(
      { name: tagName('org-ok'), ownerModel: TagOwnerModel.Organization, resources: [] },
      { organization: org, tagCategory: cat.entity },
    );
    expect(tag.entity.organizationId).toBe(org.id);
  });
});
