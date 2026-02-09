import type { UseNavigateResult } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { checkContextPermission, type NavConfig } from '../lib/checkContextPermission';
import { useAppStore } from '../store';

type SearchParams = {
  org?: string;
  space?: string;
  spoof?: string;
  [key: string]: string | undefined;
};

export type UseAuthenticatedRoutingParams = {
  pathname: string;
  search: string;
  navigate: UseNavigateResult<string>;
  navConfig: NavConfig;
  // TODO: Embed mode support - inject context from parent, skip auto-nav, notify parent of changes
  // embed?: {
  //   skipAutoNavigation?: boolean;        // Don't auto-nav to dashboard
  //   onContextChange?: (context) => void; // Notify parent window (postMessage)
  // };
};

/**
 * Handles all routing logic for authenticated layouts:
 * - Reads context from query params (?org=123, ?space=456)
 * - Syncs context changes back to URL
 * - Checks permissions and falls back to valid contexts
 * - Auto-navigates to dashboard when context changes
 *
 * Future embed mode:
 * - Parent injects context via query params: ?org=123&token=abc
 * - skipAutoNavigation keeps user on embedded page
 * - onContextChange notifies parent for deep linking
 * - Use with useAuthStrategy for token auth from parent window
 */
export const useAuthenticatedRouting = ({ pathname, search, navigate, navConfig }: UseAuthenticatedRoutingParams): { isUnauthorized: boolean } => {
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  const tenant = useAppStore((state) => state.tenant);
  const permissions = useAppStore((state) => state.permissions);
  const auth = useAppStore((state) => state.auth);

  // Handle context from query params
  useEffect(() => {
    const params = new URLSearchParams(search);
    const orgId = params.get('org');
    const spaceId = params.get('space');
    const spoofEmail = params.get('spoof');

    if (orgId && tenant.context.organization?.id !== orgId) {
      tenant.selectOrganization(orgId);
    } else if (spaceId && tenant.context.space?.id !== spaceId) {
      tenant.selectSpace(spaceId);
    }

    // Handle spoof param
    if (spoofEmail !== auth.spoofUserEmail) {
      auth.setSpoofUserEmail(spoofEmail);
    }
  }, [search, tenant.context.organization?.id, tenant.context.space?.id, auth.spoofUserEmail]);

  // Check permissions and fallback to valid context
  useEffect(() => {
    const validContext = checkContextPermission({
      path: pathname,
      permissions,
      currentContext: tenant.context,
      organizations: auth.organizations,
      navConfig,
    });

    if (!validContext) {
      setIsUnauthorized(true);
      return;
    }

    setIsUnauthorized(false);

    // If we found a different valid context, switch to it
    if (
      validContext.type !== tenant.context.type ||
      validContext.organization?.id !== tenant.context.organization?.id ||
      validContext.space?.id !== tenant.context.space?.id
    ) {
      if (validContext.type === 'organization' && validContext.organization) {
        tenant.selectOrganization(validContext.organization.id);
      } else if (validContext.type === 'space' && validContext.space) {
        tenant.selectSpace(validContext.space.id);
      } else if (validContext.type === 'personal') {
        tenant.setPersonal();
      } else if (validContext.type === 'public') {
        tenant.setPublic();
      }
    }
  }, [pathname, tenant.context, permissions, auth.organizations]);

  // Update URL when context or spoof changes
  useEffect(() => {
    const params = new URLSearchParams(search);
    const currentOrgParam = params.get('org');
    const currentSpaceParam = params.get('space');
    const currentSpoofParam = params.get('spoof');

    // Sync spoof to URL
    if (auth.spoofUserEmail && currentSpoofParam !== auth.spoofUserEmail) {
      navigate({
        search: ((prev: SearchParams) => ({ ...prev, spoof: auth.spoofUserEmail })) as unknown as true,
        replace: true,
      });
    } else if (!auth.spoofUserEmail && currentSpoofParam) {
      navigate({
        search: ((prev: SearchParams) => {
          const { spoof, ...rest } = prev;
          return rest;
        }) as unknown as true,
        replace: true,
      });
    }

    // Sync context to URL
    if (tenant.context.type === 'organization' && tenant.context.organization?.id !== currentOrgParam) {
      navigate({
        search: ((prev: SearchParams) => ({ ...prev, org: tenant.context.organization.id, space: undefined })) as unknown as true,
        replace: true,
      });
    } else if (tenant.context.type === 'space' && tenant.context.space?.id !== currentSpaceParam) {
      navigate({
        search: ((prev: SearchParams) => ({ ...prev, space: tenant.context.space.id, org: undefined })) as unknown as true,
        replace: true,
      });
    } else if (
      (tenant.context.type === 'personal' || tenant.context.type === 'public') &&
      (currentOrgParam || currentSpaceParam)
    ) {
      navigate({
        search: ((prev: SearchParams) => {
          const { org, space, ...rest } = prev;
          return rest;
        }) as unknown as true,
        replace: true,
      });
    }
  }, [tenant.context.type, tenant.context.organization?.id, tenant.context.space?.id, auth.spoofUserEmail, search]);

  // Auto-navigate to dashboard when context changes
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    navigate({ to: '/dashboard' });
  }, [tenant.context.type, tenant.context.organization?.id, tenant.context.space?.id]);

  return { isUnauthorized };
};
