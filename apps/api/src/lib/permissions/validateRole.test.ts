import { describe, expect, it } from 'bun:test';
import { Role } from '@template/db/generated/client/enums';
import { HTTPException } from 'hono/http-exception';
import { validateRole } from '#/lib/permissions/validateRole';

describe('validateRole', () => {
  it('should return valid role when given valid Role enum value', () => {
    expect(validateRole('owner')).toBe(Role.owner);
    expect(validateRole('admin')).toBe(Role.admin);
    expect(validateRole('member')).toBe(Role.member);
    expect(validateRole('viewer')).toBe(Role.viewer);
  });

  it('should throw HTTPException with 500 status when given invalid string', () => {
    expect(() => validateRole('invalid_role')).toThrow(HTTPException);

    try {
      validateRole('superuser');
    } catch (error) {
      expect(error).toBeInstanceOf(HTTPException);
      expect((error as HTTPException).status).toBe(500);
      expect((error as HTTPException).message).toContain('Invalid role value');
      expect((error as HTTPException).message).toContain('superuser');
    }
  });

  it('should throw HTTPException when given non-string value', () => {
    expect(() => validateRole(123)).toThrow(HTTPException);
    expect(() => validateRole(null)).toThrow(HTTPException);
    expect(() => validateRole(undefined)).toThrow(HTTPException);
    expect(() => validateRole({})).toThrow(HTTPException);
    expect(() => validateRole([])).toThrow(HTTPException);
  });

  it('should include expected roles in error message', () => {
    try {
      validateRole('bad_role');
    } catch (error) {
      expect((error as HTTPException).message).toContain('owner');
      expect((error as HTTPException).message).toContain('admin');
      expect((error as HTTPException).message).toContain('member');
      expect((error as HTTPException).message).toContain('viewer');
    }
  });
});
