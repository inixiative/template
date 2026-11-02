/**
 * @atlas
 * @kind registry
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { InquiryReceivedItem, InquirySentItem } from '@template/sdk';
import { Button, Label, Modal, SlugInput } from '@template/ui/components';
import { useResolveInquiryMutation } from '@template/ui/hooks/inquiry';
import { registerInquiryType } from '@template/ui/lib/inquiries/registry';
import { useState } from 'react';

const TransferSourceSummary = ({ inquiry }: { inquiry: InquirySentItem }) => (
  <span>{inquiry.targetOrganization?.name ?? '—'}</span>
);

const TransferTargetSummary = ({ inquiry }: { inquiry: InquiryReceivedItem }) => (
  <span>{inquiry.sourceSpace?.name ?? '—'}</span>
);

const TransferTargetReview = ({
  inquiry,
  onClose,
}: {
  inquiry: InquiryReceivedItem;
  onClose: () => void;
}) => {
  const resolveMutation = useResolveInquiryMutation();
  const [slug, setSlug] = useState(inquiry.sourceSpace?.slug ?? '');

  const approve = (e: React.FormEvent) => {
    e.preventDefault();
    resolveMutation.mutate(
      { inquiry, status: 'approved', resolution: { slug } },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal isOpen onClose={onClose} title={`Accept ${inquiry.sourceSpace?.name ?? 'space'}`}>
      <form onSubmit={approve} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="transfer-slug">Slug in your organization</Label>
          <SlugInput
            id="transfer-slug"
            value={slug}
            onChange={setSlug}
            className="font-mono text-sm"
          />
          {resolveMutation.error && (
            <p className="text-xs text-destructive">{resolveMutation.error.message}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!slug || resolveMutation.isPending}>
            Approve
          </Button>
        </div>
      </form>
    </Modal>
  );
};

registerInquiryType('transferSpace', {
  label: 'Space Transfer',
  source: { summary: TransferSourceSummary },
  target: { summary: TransferTargetSummary, review: TransferTargetReview },
});
