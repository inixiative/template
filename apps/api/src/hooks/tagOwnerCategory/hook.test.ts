import { afterAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
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
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';
import { registerTagOwnerCategoryHook } from '#/hooks/tagOwnerCategory/hook';

registerMemberSelfGrantHook();

registerRulesHook();
registerTagOwnerCategoryHook();
registerSoftDeleteCascadeHook();

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

  describe('updateManyAndReturn', () => {
    const createUserTags = async (count: number) => {
      const { entity: user } = await createUser();
      const cat = await createTagCategory({ ownerModel: TagOwnerModel.User }, { user });
      const tags = [];
      for (let i = 0; i < count; i++) {
        const tag = await createTag(
          { name: tagName('bulk'), ownerModel: TagOwnerModel.User, resources: [] },
          { user, tagCategory: cat.entity },
        );
        tags.push(tag.entity);
      }
      return { user, category: cat.entity, tags };
    };

    it('soft-deletes multiple tags without re-validating unchanged owners', async () => {
      const { user, tags } = await createUserTags(3);
      const deletedAt = new Date();
      const result = await db.tag.updateManyAndReturn({
        where: { userId: user.id },
        data: { deletedAt },
      });
      expect(result.map((t) => t.id).sort()).toEqual(tags.map((t) => t.id).sort());
      expect(result.every((t) => t.deletedAt?.getTime() === deletedAt.getTime())).toBe(true);
    });

    it('returns no rows when nothing matches', async () => {
      const result = await db.tag.updateManyAndReturn({
        where: { name: tagName('absent') },
        data: { deletedAt: new Date() },
      });
      expect(result).toEqual([]);
    });

    it('returns no rows when nothing matches an owner change', async () => {
      const { entity: other } = await createUser();
      const result = await db.tag.updateManyAndReturn({
        where: { name: tagName('absent') },
        data: { userId: other.id },
      });
      expect(result).toEqual([]);
    });

    it('rejects moving multiple tags to an owner their category does not have', async () => {
      const { user, tags } = await createUserTags(2);
      const { entity: other } = await createUser();
      const update = async () =>
        db.tag.updateManyAndReturn({ where: { userId: user.id }, data: { userId: other.id } });
      await expect(update()).rejects.toThrow(/Tag\.userId .* must match TagCategory\.userId/);
      const unchanged = await db.tag.findMany({ where: { id: { in: tags.map((t) => t.id) } } });
      expect(unchanged.every((t) => t.userId === user.id)).toBe(true);
    });

    it('rejects moving multiple tags into a category with a different ownerModel', async () => {
      const { user } = await createUserTags(2);
      const platformCat = await createTagCategory({ ownerModel: TagOwnerModel.platform });
      const update = async () =>
        db.tag.updateManyAndReturn({
          where: { userId: user.id },
          data: { tagCategoryId: platformCat.entity.id },
        });
      await expect(update()).rejects.toThrow(/Tag\.ownerModel \(User\) must match/);
    });

    it('rejects moving multiple tags into a nonexistent category', async () => {
      const { user } = await createUserTags(2);
      const update = async () =>
        db.tag.updateManyAndReturn({
          where: { userId: user.id },
          data: { tagCategoryId: '00000000-0000-0000-0000-000000000000' },
        });
      await expect(update()).rejects.toThrow(/TagCategory 0{8}-.* not found/);
    });

    it('allows moving multiple tags into another category with the same owner', async () => {
      const { user, tags } = await createUserTags(2);
      const target = await createTagCategory({ ownerModel: TagOwnerModel.User }, { user });
      const result = await db.tag.updateManyAndReturn({
        where: { userId: user.id },
        data: { tagCategoryId: target.entity.id },
      });
      expect(result).toHaveLength(tags.length);
      expect(result.every((t) => t.tagCategoryId === target.entity.id)).toBe(true);
    });
  });

  it('cascades a user soft delete to its tags and tag categories', async () => {
    const { entity: user } = await createUser();
    const cat = await createTagCategory({ ownerModel: TagOwnerModel.User }, { user });
    const first = await createTag(
      { name: tagName('cascade'), ownerModel: TagOwnerModel.User, resources: [] },
      { user, tagCategory: cat.entity },
    );
    const second = await createTag(
      { name: tagName('cascade'), ownerModel: TagOwnerModel.User, resources: [] },
      { user, tagCategory: cat.entity },
    );
    await db.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
    const tags = await db.tag.findMany({
      where: { id: { in: [first.entity.id, second.entity.id] }, deletedAt: { not: null } },
    });
    expect(tags).toHaveLength(2);
  });
});
