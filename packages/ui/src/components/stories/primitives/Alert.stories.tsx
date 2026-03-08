import type { Story } from '@ladle/react';
import { Alert } from '@template/ui/components/primitives/Alert';
import { Skeleton } from '@template/ui/components/primitives/Skeleton';

export const Default: Story = () => <Alert title="Notice">A neutral informational message.</Alert>;

export const Success: Story = () => (
  <Alert title="Saved" tone="success">
    Changes were applied successfully.
  </Alert>
);

export const Warning: Story = () => (
  <Alert title="Check details" tone="warning">
    Some values may need attention before continuing.
  </Alert>
);

export const ErrorState: Story = () => (
  <Alert title="Failed" tone="error">
    The request could not be completed.
  </Alert>
);

export const Loading: Story = () => <Skeleton count={3} />;
