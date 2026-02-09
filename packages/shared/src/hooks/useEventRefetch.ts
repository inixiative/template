import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { type AppEventPayload, useAppEvents } from '@template/shared/hooks/useAppEvents';
import { useEffect, useRef } from 'react';

type EventMatcher = string | RegExp | ((event: AppEventPayload) => boolean);

type RefetchRule = {
  /** Event type(s) to match - string, regex, or function */
  match: EventMatcher | EventMatcher[];
  /** Query keys to invalidate when matched */
  queryKeys: QueryKey[];
};

type UseEventRefetchOptions = {
  /** WebSocket URL (defaults to same origin) */
  url?: string;
  /** Channels to subscribe to */
  channels?: string[];
  /** Rules for when to refetch queries */
  rules: RefetchRule[];
  /** Called when any event is received (before refetch) */
  onEvent?: (event: AppEventPayload) => void;
};

const matchEvent = (event: AppEventPayload, matcher: EventMatcher): boolean => {
  if (typeof matcher === 'string') {
    // Support wildcards: "user.*" matches "user.signedUp", "user.updated", etc.
    if (matcher.includes('*')) {
      const pattern = new RegExp('^' + matcher.replace(/\*/g, '.*') + '$');
      return pattern.test(event.type);
    }
    return event.type === matcher;
  }

  if (matcher instanceof RegExp) {
    return matcher.test(event.type);
  }

  return matcher(event);
};

const matchesAny = (event: AppEventPayload, matchers: EventMatcher | EventMatcher[]): boolean => {
  const matcherArray = Array.isArray(matchers) ? matchers : [matchers];
  return matcherArray.some((m) => matchEvent(event, m));
};

/**
 * Hook that refetches TanStack Query queries when specific WebSocket events are received.
 *
 * @example
 * ```tsx
 * useEventRefetch({
 *   rules: [
 *     // When any user event occurs, refetch the current user
 *     { match: 'user.*', queryKeys: [['user', 'current']] },
 *
 *     // When an inixiative is updated, refetch its data
 *     {
 *       match: (e) => e.type === 'inixiative.updated' && e.resourceId === inixiativeId,
 *       queryKeys: [['inixiative', inixiativeId]],
 *     },
 *
 *     // When any participant joins, refetch the participants list
 *     { match: 'participant.joined', queryKeys: [['inixiative', inixiativeId, 'participants']] },
 *   ],
 * });
 * ```
 */
export const useEventRefetch = (options: UseEventRefetchOptions): void => {
  const { url, channels, rules, onEvent } = options;
  const queryClient = useQueryClient();
  const rulesRef = useRef(rules);

  // Keep rules ref updated
  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);

  useAppEvents({
    url,
    channels,
    onEvent: (event) => {
      onEvent?.(event);

      // Check each rule
      for (const rule of rulesRef.current) {
        if (matchesAny(event, rule.match)) {
          // Invalidate all matching query keys
          for (const queryKey of rule.queryKeys) {
            queryClient.invalidateQueries({ queryKey });
          }
        }
      }
    },
  });
};
