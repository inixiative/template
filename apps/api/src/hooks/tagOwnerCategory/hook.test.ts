import { afterAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { TagResource } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganization,
  createTag,
  createTagCategory,
  createUser,
  getNextSeq,
} from '@template/db/test';
import { registerRulesHook } from '#/hooks/rules/hook';
import { registerTagOwnerCategoryHook } from '#/hooks/tagOwnerCategory/hook';

registerRulesHook();
registerTagOwnerCategoryHook();

afterAll(async () => {
  await cleanupTouchedTables(db);
  clearHookRegistry();
});

const tagName = (prefix: string) => `${prefix}-${getNextSeq()}`;

describe('tagOwnerCategory hook', () => {
  it('allows a platform tag in a platform category', async () => {
    const cat = await createTagCategory({ ownerModel: TagResource.platform });
    const tag = await createTag(
      { name: tagName('platform-ok'), ownerModel: TagResource.platform, resources: [] },
      { tagCategory: cat.entity },
    );
    expect(tag.entity.ownerModel).toBe(TagResource.platform);
    expect(tag.entity.tagCategoryId).toBe(cat.entity.id);
  });

  it('allows a User tag in a matching User category', async () => {
    const { entity: user } = await createUser();
    const cat = await createTagCategory({ ownerModel: TagResource.User }, { user });
    const tag = await createTag(
      { name: tagName('user-ok'), ownerModel: TagResource.User, resources: [] },
      { user, tagCategory: cat.entity },
    );
    expect(tag.entity.userId).toBe(user.id);
  });

  it('rejects a User tag in a platform category (ownerModel mismatch)', async () => {
    const { entity: user } = await createUser();
    const cat = await createTagCategory({ ownerModel: TagResource.platform });
    const create = async () =>
      createTag(
        { name: tagName('mismatch-owner'), ownerModel: TagResource.User, resources: [] },
        { user, tagCategory: cat.entity },
      );
    await expect(create()).rejects.toThrow(/ownerModel/);
  });

  it('rejects a User tag whose userId differs from the User category', async () => {
    const { entity: a } = await createUser();
    const { entity: b } = await createUser();
    const cat = await createTagCategory({ ownerModel: TagResource.User }, { user: a });
    const create = async () =>
      createTag(
        { name: tagName('mismatch-fk'), ownerModel: TagResource.User, resources: [] },
        { user: b, tagCategory: cat.entity },
      );
    await expect(create()).rejects.toThrow(/userId/);
  });

  it('rejects updating a tag to mismatch its category', async () => {
    const { entity: a } = await createUser();
    const { entity: b } = await createUser();
    const cat = await createTagCategory({ ownerModel: TagResource.User }, { user: a });
    const tag = await createTag(
      { name: tagName('update-target'), ownerModel: TagResource.User, resources: [] },
      { user: a, tagCategory: cat.entity },
    );
    const update = async () => db.tag.update({ where: { id: tag.entity.id }, data: { userId: b.id } });
    await expect(update()).rejects.toThrow(/userId/);
  });

  it('allows an Organization tag in a matching Organization category', async () => {
    const { entity: org } = await createOrganization();
    const cat = await createTagCategory({ ownerModel: TagResource.Organization }, { organization: org });
    const tag = await createTag(
      { name: tagName('org-ok'), ownerModel: TagResource.Organization, resources: [] },
      { organization: org, tagCategory: cat.entity },
    );
    expect(tag.entity.organizationId).toBe(org.id);
  });
});
