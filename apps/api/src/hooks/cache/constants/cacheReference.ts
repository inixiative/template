import type { Prisma, User, Session, Token, OrganizationUser, WebhookSubscription } from '@template/db';
import { cacheKey } from '#/lib/cache';

/**
 * Cache Key Pattern (use cacheKey helper)
 *
 * Format: <Model>:<field>:<value>[:<tags>][:*]
 *
 * Examples:
 *   cacheKey('User', id)                                   → User:id:abc-123
 *   cacheKey('User', email, 'email')                       → User:email:foo@example.com
 *   cacheKey('User', id, 'id', ['OrganizationUsers'])      → User:id:abc-123:OrganizationUsers
 *   cacheKey('Session', userId, 'userId', [], true)        → Session:userId:abc-123:*
 */

export const CACHE_REFERENCE: Partial<Record<Prisma.ModelName, (r: never) => string[]>> = {
  User: (r: User) => [
    cacheKey('User', r.id),
    cacheKey('User', r.email, 'email'),
  ],

  Session: (r: Session) => [
    cacheKey('Session', r.id),
    cacheKey('Session', r.userId, 'userId', [], true),
  ],

  Token: (r: Token) => [
    cacheKey('Token', r.keyHash, 'keyHash'),
  ],

  OrganizationUser: (r: OrganizationUser) => [
    cacheKey('OrganizationUser', r.id),
    cacheKey('User', r.userId, 'id', ['OrganizationUsers']),
  ],

  WebhookSubscription: (r: WebhookSubscription) => [
    cacheKey('WebhookSubscription', r.ownerId, 'ownerId', [r.model]),
  ],
};

export function fetchCacheKeys(model: Prisma.ModelName, record: Record<string, unknown>): string[] {
  const fn = CACHE_REFERENCE[model];
  if (!fn) return [];
  return fn(record);
}
