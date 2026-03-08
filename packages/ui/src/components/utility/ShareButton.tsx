import { Button } from '@template/ui/components/primitives/Button';
import { Check, Share2 } from 'lucide-react';
import { useState } from 'react';

export type ShareButtonProps = {
  className?: string;
};

export const ShareButton = ({ className }: ShareButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleShare} className={className} aria-label="Share this page">
      {copied ? (
        <span className="flex items-center gap-1.5 text-xs">
          <Check className="h-4 w-4" />
          Copied!
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-xs">
          <Share2 className="h-4 w-4" />
          Share
        </span>
      )}
    </Button>
  );
};
