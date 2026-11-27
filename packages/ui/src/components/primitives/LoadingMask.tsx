/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { loadingMaskAttributes } from '@template/ui/components/primitives/loadingMaskAttributes';
import type * as React from 'react';

type LoadingMaskProps = React.HTMLAttributes<HTMLDivElement> & { isLoading: boolean };

const LoadingMask = ({ isLoading, ...props }: LoadingMaskProps) => (
  <div {...props} {...loadingMaskAttributes(isLoading)} />
);

export type { LoadingMaskProps };
export { LoadingMask };
