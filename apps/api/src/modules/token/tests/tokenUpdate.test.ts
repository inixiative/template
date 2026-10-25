import { describe, it } from 'bun:test';

describe('PATCH /token/:id — a token is full or narrowed, and either can change (situations from #210)', () => {
  it.todo('the owner narrows a full token, then makes it full again', () => {});
  it.todo('a token cannot change itself', () => {});
  it.todo('a narrowed editor cannot make a token full', () => {});
  it.todo('another user cannot change my token', () => {});

  describe('organization tokens: capped by what the editor holds', () => {
    it.todo('an admin cannot give a token an action it does not hold itself', () => {});
    it.todo('an admin holding the action gives it, or less', () => {});
    it.todo('an admin cannot raise it to owner or grant own', () => {});
    it.todo('a viewer cannot change it at all', () => {});
  });
});
