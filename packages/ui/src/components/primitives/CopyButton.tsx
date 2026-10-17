/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Icon } from '@iconify/react';
import { Button } from '@template/ui/components/primitives/Button';
import { toast } from '@template/ui/lib/toast';
import { useState } from 'react';

export type CopyButtonProps = {
  value: string;
  label?: string;
  className?: string;
};

export const CopyButton = ({ value, label = 'Copy', className }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to the clipboard. Select the text and copy it manually.');
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy} className={className}>
      <Icon icon={copied ? 'lucide:check' : 'lucide:copy'} className="h-4 w-4 mr-2" />
      {copied ? 'Copied' : label}
    </Button>
  );
};
