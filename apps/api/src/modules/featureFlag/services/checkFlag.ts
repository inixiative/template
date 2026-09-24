/**
 * @atlas
 * @kind service
 * @partOf feature:featureFlag
 * @uses none
 */
import type { CustomerModel, FeatureFlagValueType, ProviderModel } from '@template/db/generated/client/enums';
import { LogScope, log } from '@template/shared/logger';
import type { FlagValue } from '#/modules/featureFlag/lib/zeroFor';
import { hopKey, type ResolvedFlag, type ResolvedFlags } from '#/modules/featureFlag/services/resolveFlags';

export type FlagOwner = 'platform' | { ownerModel: ProviderModel; ownerId: string };

export type FlagSubject = { customerModel: CustomerModel; customerId: string };

type TypedValue = { boolean: boolean; string: string; number: number; json: FlagValue };

const reported = new Set<string>();

const reportOnce = (key: string, message: string): void => {
  if (reported.has(key)) return;
  reported.add(key);
  log.warn(message, LogScope.api);
};

const ownerOf = (owner: FlagOwner) =>
  owner === 'platform' ? { ownerModel: 'platform' as const, ownerId: 'platform' } : owner;

export const findResolvedFlag = (
  owner: FlagOwner,
  slug: string,
  resolved: ResolvedFlags,
  subject?: FlagSubject,
): ResolvedFlag | null => {
  const hop = hopKey(ownerOf(owner));
  const candidates = resolved.refs.filter((ref) => hopKey(ref.provider) === hop && slug in ref.flags);
  const ref = subject
    ? candidates.find(
        (each) =>
          each.customerRef.customerModel === subject.customerModel &&
          each.customerRef[`customer${subject.customerModel}Id`] === subject.customerId,
      )
    : (candidates.find((each) => each.customerRef.customerModel === 'User') ?? candidates[0]);
  return ref?.flags[slug] ?? null;
};

export const checkFlag = <T extends FeatureFlagValueType>(
  owner: FlagOwner,
  slug: string,
  type: T,
  resolved: ResolvedFlags,
  subject?: FlagSubject,
): TypedValue[T] | null => {
  const found = findResolvedFlag(owner, slug, resolved, subject);
  if (!found) return null;
  if (found.flag.valueType !== type) {
    reportOnce(
      `${hopKey(ownerOf(owner))}:${slug}`,
      `feature flag ${slug} is ${found.flag.valueType}; a reader asked for ${type}`,
    );
    return null;
  }
  return found.value as TypedValue[T] | null;
};
