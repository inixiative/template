/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */

import { AuthCard } from '@template/ui/components/auth/AuthCard';
import { Button } from '@template/ui/components/primitives/Button';
import type { ReactNode } from 'react';

export type AuthNoticeCardProps = {
  title: string;
  description: ReactNode;
  descriptionRole: 'status' | 'alert';
  actionLabel: string;
  onAction: () => void;
};

export const AuthNoticeCard = ({
  title,
  description,
  descriptionRole,
  actionLabel,
  onAction,
}: AuthNoticeCardProps) => (
  <AuthCard title={title} description={description} descriptionRole={descriptionRole}>
    <Button type="button" className="w-full" onClick={onAction}>
      {actionLabel}
    </Button>
  </AuthCard>
);
