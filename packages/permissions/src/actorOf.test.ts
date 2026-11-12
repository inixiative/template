import { describe, expect, it } from 'bun:test';
import { actorOf } from '@template/permissions/actorOf';
import { ActorModel } from '@template/permissions/client';

describe('actorOf', () => {
  it("keeps the actor row's columns and drops its relations and redacted fields", () => {
    const token = {
      id: 't1',
      ownerModel: 'Integration',
      userId: 'u1',
      keyHash: 'secret',
      integration: { id: 'i1' },
      user: { id: 'u1', email: 'a@b.c' },
    };
    expect(actorOf(ActorModel.Token, token)).toEqual({
      model: ActorModel.Token,
      record: { id: 't1', ownerModel: 'Integration', userId: 'u1' },
    });
  });

  it('a user keeps its columns and drops its memberships', () => {
    const user = { id: 'u1', email: 'a@b.c', organizationUsers: [{ id: 'm1' }] };
    expect(actorOf(ActorModel.User, user).record).toEqual({ id: 'u1', email: 'a@b.c' });
  });
});
