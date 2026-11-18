/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { useLocation } from '@tanstack/react-router';
import { CopyButton } from '@template/ui/components/primitives/CopyButton';

export type CopyPageLinkButtonProps = {
  className?: string;
};

export const CopyPageLinkButton = ({ className }: CopyPageLinkButtonProps) => {
  const href = useLocation({ select: (location) => location.href });
  return (
    <CopyButton
      value={new URL(href, window.location.origin).toString()}
      label="Copy link"
      className={className}
    />
  );
};
