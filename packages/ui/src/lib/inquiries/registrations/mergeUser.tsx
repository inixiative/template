/**
 * @atlas
 * @kind registry
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { InquiryItem } from '@template/sdk';
import { type MergeUserContent, mergeUserContentSchema } from '@template/shared/inquiry';
import { Button, Modal } from '@template/ui/components';
import { useResolveInquiryMutation } from '@template/ui/hooks/inquiry';
import { registerInquiryType } from '@template/ui/lib/inquiries/registry';

const sourceUserOf = (inquiry: InquiryItem): MergeUserContent['sourceUser'] | undefined =>
  mergeUserContentSchema.safeParse(inquiry.content).data?.sourceUser;

const MergeSourceSummary = ({ inquiry }: { inquiry: InquiryItem }) => (
  <span>{inquiry.targetUser?.email ?? '—'}</span>
);

const MergeTargetSummary = ({ inquiry }: { inquiry: InquiryItem }) => (
  <span>{sourceUserOf(inquiry)?.email ?? '—'}</span>
);

const MergeTargetReview = ({ inquiry, onClose }: { inquiry: InquiryItem; onClose: () => void }) => {
  const resolveMutation = useResolveInquiryMutation();
  const sourceUser = sourceUserOf(inquiry);

  const approve = () => {
    if (!sourceUser) return;
    resolveMutation.mutate(
      { inquiry, status: 'approved', resolution: { sourceUser } },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal isOpen onClose={onClose} title="Merge users">
      <div className="space-y-4">
        <p className="text-sm">
          Everything <span className="font-medium">{sourceUser?.email ?? 'this account'}</span>{' '}
          holds moves to your account. Where you both hold the same thing, yours is kept. The other
          account is then deleted. This cannot be undone.
        </p>
        <p className="text-sm text-muted-foreground">
          Its password, passkeys, two-factor and sessions are deleted with it. Accounts it signs in
          with through another provider move to yours.
        </p>
        {resolveMutation.error && (
          <p className="text-xs text-destructive">{resolveMutation.error.message}</p>
        )}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!sourceUser || resolveMutation.isPending}
            onClick={approve}
          >
            Merge into my account
          </Button>
        </div>
      </div>
    </Modal>
  );
};

registerInquiryType('mergeUser', {
  label: 'User Merge',
  source: { summary: MergeSourceSummary },
  target: { summary: MergeTargetSummary, review: MergeTargetReview, approvesOnlyInReview: true },
});
