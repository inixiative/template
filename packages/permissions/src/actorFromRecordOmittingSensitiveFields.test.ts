import { describe, expect, it } from 'bun:test';
import { actorFromRecordOmittingSensitiveFields } from '@template/permissions/actorFromRecordOmittingSensitiveFields';
import { ActorModel } from '@template/permissions/client';

describe('actorFromRecordOmittingSensitiveFields', () => {
  it("keeps the actor row's columns and drops its relations and redacted fields", () => {
    const token = {
      id: 't1',
      ownerModel: 'Integration',
      userId: 'u1',
      keyHash: 'secret',
      integration: { id: 'i1' },
      user: { id: 'u1', email: 'a@b.c' },
    };
    expect(actorFromRecordOmittingSensitiveFields(ActorModel.Token, token)).toEqual({
      model: ActorModel.Token,
      record: { id: 't1', ownerModel: 'Integration', userId: 'u1' },
    });
  });

  it('a user keeps its columns and drops its memberships', () => {
    const user = { id: 'u1', email: 'a@b.c', organizationUsers: [{ id: 'm1' }] };
    expect(actorFromRecordOmittingSensitiveFields(ActorModel.User, user).record).toEqual({
      id: 'u1',
      email: 'a@b.c',
    });
  });
});
