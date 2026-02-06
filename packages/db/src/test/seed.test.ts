import { describe, expect, test, beforeAll } from 'bun:test';
import { validate as isUUID, version as uuidVersion } from 'uuid';
import seeds from '../../prisma/seeds';

describe('Seed System', () => {
  describe('UUID Validation', () => {
    test('all seed IDs are valid UUIDs', () => {
      for (const { model, records } of seeds) {
        for (const record of records) {
          const id = record.id as string;
          expect(isUUID(id)).toBe(true);
        }
      }
    });

    test('all seed IDs are UUIDv7', () => {
      for (const { model, records } of seeds) {
        for (const record of records) {
          const id = record.id as string;
          const version = uuidVersion(id);
          expect(version).toBe(7);
        }
      }
    });

    test('no duplicate IDs across all seeds', () => {
      const idSet = new Set<string>();
      const duplicates: string[] = [];

      for (const { model, records } of seeds) {
        for (const record of records) {
          const id = record.id as string;
          if (idSet.has(id)) {
            duplicates.push(id);
          }
          idSet.add(id);
        }
      }

      expect(duplicates).toEqual([]);
    });
  });

  describe('Seed Structure', () => {
    test('all seeds have required fields', () => {
      for (const seed of seeds) {
        expect(seed).toHaveProperty('model');
        expect(seed).toHaveProperty('records');
        expect(Array.isArray(seed.records)).toBe(true);
      }
    });

    test('all seed records have id field', () => {
      for (const { model, records } of seeds) {
        for (const record of records) {
          expect(record).toHaveProperty('id');
          expect(typeof record.id).toBe('string');
        }
      }
    });

    test('updateOmitFields is array if present', () => {
      for (const seed of seeds) {
        if (seed.updateOmitFields) {
          expect(Array.isArray(seed.updateOmitFields)).toBe(true);
        }
      }
    });
  });

  describe('Prime Seed Data', () => {
    test('prime users exist', () => {
      const userSeed = seeds.find((s) => s.model === 'user');
      expect(userSeed).toBeDefined();

      const primeUsers = userSeed!.records.filter((r) => r.prime);
      expect(primeUsers.length).toBe(3);

      const emails = primeUsers.map((u) => u.email);
      expect(emails).toContain('super@inixiative.com');
      expect(emails).toContain('owner@inixiative.com');
      expect(emails).toContain('customer@inixiative.com');
    });

    test('prime accounts have passwords', () => {
      const accountSeed = seeds.find((s) => s.model === 'account');
      expect(accountSeed).toBeDefined();

      const primeAccounts = accountSeed!.records.filter((r) => r.prime);
      expect(primeAccounts.length).toBeGreaterThan(0);

      for (const account of primeAccounts) {
        expect(account).toHaveProperty('password');
        expect(typeof account.password).toBe('string');
        expect(account.password).not.toBe('');
        // Should be bcrypt hash (starts with $2a$ or $2b$)
        expect(account.password).toMatch(/^\$2[ab]\$/);
      }
    });

    test('prime organization exists', () => {
      const orgSeed = seeds.find((s) => s.model === 'organization');
      expect(orgSeed).toBeDefined();

      const primeOrgs = orgSeed!.records.filter((r) => r.prime);
      expect(primeOrgs.length).toBeGreaterThan(0);
      expect(primeOrgs[0].name).toBe('Acme Corporation');
    });

    test('prime space exists', () => {
      const spaceSeed = seeds.find((s) => s.model === 'space');
      expect(spaceSeed).toBeDefined();

      const primeSpaces = spaceSeed!.records.filter((r) => r.prime);
      expect(primeSpaces.length).toBeGreaterThan(0);
      expect(primeSpaces[0].name).toBe('Main Space');
    });

    test('prime tokens exist', () => {
      const tokenSeed = seeds.find((s) => s.model === 'token');
      expect(tokenSeed).toBeDefined();

      const primeTokens = tokenSeed!.records.filter((r) => r.prime);
      expect(primeTokens.length).toBe(3);

      const ownerModels = primeTokens.map((t) => t.ownerModel);
      expect(ownerModels).toContain('User');
      expect(ownerModels).toContain('OrganizationUser');
      expect(ownerModels).toContain('SpaceUser');
    });
  });

  describe('Foreign Key Order', () => {
    test('seeds are in FK-safe order', () => {
      const modelOrder = seeds.map((s) => s.model);

      // Users must come before accounts
      const userIndex = modelOrder.indexOf('user');
      const accountIndex = modelOrder.indexOf('account');
      expect(userIndex).toBeLessThan(accountIndex);

      // Organizations must come before organizationUser
      const orgIndex = modelOrder.indexOf('organization');
      const orgUserIndex = modelOrder.indexOf('organizationUser');
      expect(orgIndex).toBeLessThan(orgUserIndex);

      // Organizations must come before spaces
      const spaceIndex = modelOrder.indexOf('space');
      expect(orgIndex).toBeLessThan(spaceIndex);

      // Spaces must come before spaceUser
      const spaceUserIndex = modelOrder.indexOf('spaceUser');
      expect(spaceIndex).toBeLessThan(spaceUserIndex);

      // Users must come before tokens
      const tokenIndex = modelOrder.indexOf('token');
      expect(userIndex).toBeLessThan(tokenIndex);
    });
  });

  describe('ID Patterns', () => {
    test('all prime seed IDs follow consistent pattern', () => {
      // All prime seeds should use the pattern: 01936d42-8c4a-7000-8000-...
      const pattern = /^01936d42-8c4a-7000-8000-/;

      for (const { model, records } of seeds) {
        for (const record of records) {
          if (record.prime) {
            const id = record.id as string;
            expect(id).toMatch(pattern);
          }
        }
      }
    });

    test('seed IDs use proper UUIDv7 format', () => {
      // UUIDv7 format: xxxxxxxx-xxxx-7xxx-8xxx-xxxxxxxxxxxx
      //                              ^    ^
      //                           version variant

      for (const { model, records } of seeds) {
        for (const record of records) {
          const id = record.id as string;
          const parts = id.split('-');

          // Check version field (3rd segment should start with 7)
          expect(parts[2][0]).toBe('7');

          // Check variant field (4th segment should start with 8, 9, a, or b)
          expect(['8', '9', 'a', 'b']).toContain(parts[3][0]);
        }
      }
    });
  });
});
