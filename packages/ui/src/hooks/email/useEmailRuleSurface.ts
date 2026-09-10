/**
 * @atlas
 * @kind hook
 * @partOf feature:email
 * @uses primitive:sdk
 */
import type { SourceValues } from '@inixiative/json-rules';
import type { Decoration, RuleBuilderSource } from '@inixiative/rules-builder';
import { adminEmailTemplateRuleSurface } from '@template/sdk';
import { useQuery } from '@template/ui/hooks/useQuery';
import { apiFetchInternal } from '@template/ui/lib/apiFetchInternal';
import { useAppStore } from '@template/ui/store';

export type EmailRuleSurface = {
  source: RuleBuilderSource;
  sourceValues: SourceValues[];
  decoration: Decoration;
};

export const emailRuleSurfaceQueryKey = (slug: string, locale?: string) =>
  ['email-rule-surface', slug, locale ?? 'en'] as const;

export const useEmailRuleSurface = (slug: string | undefined, locale?: string) =>
  useQuery({
    queryKey: emailRuleSurfaceQueryKey(slug ?? '', locale),
    queryFn: async (): Promise<EmailRuleSurface> => {
      const { spoofUserEmail } = useAppStore.getState().auth;
      const { data } = await apiFetchInternal(
        (requestOptions) =>
          adminEmailTemplateRuleSurface({ ...requestOptions, body: { slug: slug ?? '', locale }, throwOnError: true }),
        { spoofUserEmail },
      )();
      return {
        source: data.source as RuleBuilderSource,
        sourceValues: data.sourceValues as SourceValues[],
        decoration: data.decoration as Decoration,
      };
    },
    enabled: Boolean(slug),
    staleTime: Number.POSITIVE_INFINITY,
  });
