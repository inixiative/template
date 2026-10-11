/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:flows
 */
import { useLocation } from '@tanstack/react-router';
import {
  type NavigationPolicy,
  navigationTargetHref,
  resolveNavigationTarget,
} from '@template/ui/lib/resolveNavigationTarget';
import { useAppStore } from '@template/ui/store';
import * as React from 'react';

export interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  flow?: false;
}

const isPlainLeftClick = (event: React.MouseEvent<HTMLAnchorElement>) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, flow, onClick, target, ...props }, ref) => {
    const location = useLocation();
    const spoofUserEmail = useAppStore((state) => state.auth.spoofUserEmail);
    const navigatePreserving = useAppStore((state) => state.navigation.navigatePreserving);
    const policy: NavigationPolicy = flow === false ? 'context' : 'flow';

    const href = navigationTargetHref(
      resolveNavigationTarget(to, policy, {
        search: location.searchStr,
        hash: location.hash ? `#${location.hash}` : '',
        spoofUserEmail,
      }),
    );

    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || !isPlainLeftClick(event) || (target && target !== '_self'))
        return;
      event.preventDefault();
      navigatePreserving(to, policy);
    };

    return <a ref={ref} href={href} target={target} onClick={handleClick} {...props} />;
  },
);
Link.displayName = 'Link';

export { Link };
