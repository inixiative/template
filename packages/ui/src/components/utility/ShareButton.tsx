import { Button } from '@template/ui/components/Button';
import { Check, Share2 } from 'lucide-react';
import { useState } from 'react';

export type ShareButtonProps = {
  className?: string;
};

export const ShareButton = ({ className }: ShareButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ url, title: 'Share this page' });
        return;
      } catch {
        // Fall back to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleShare}
      className={className}
      aria-label="Share this page"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          <span className="text-xs">Copied!</span>
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          <span className="text-xs">Share</span>
        </>
      )}
    </Button>
  );
};
