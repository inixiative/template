/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Button } from '@template/ui/components/primitives/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@template/ui/components/primitives/Card';
import type { ReactNode } from 'react';

export type AuthNoticeCardProps = {
  title: string;
  description: ReactNode;
  role: 'status' | 'alert';
  actionLabel: string;
  onAction?: () => void;
};

export const AuthNoticeCard = ({
  title,
  description,
  role,
  actionLabel,
  onAction,
}: AuthNoticeCardProps) => (
  <Card className="w-full shadow-lg border-border/50">
    <CardHeader>
      <CardTitle className="text-xl">{title}</CardTitle>
      <CardDescription role={role}>{description}</CardDescription>
    </CardHeader>
    {onAction && (
      <CardContent>
        <Button type="button" className="w-full" onClick={onAction}>
          {actionLabel}
        </Button>
      </CardContent>
    )}
  </Card>
);
