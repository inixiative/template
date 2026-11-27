/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@template/ui/components/primitives/Card';
import type { ReactNode } from 'react';

export type AuthCardProps = {
  title: string;
  description: ReactNode;
  descriptionRole?: 'status' | 'alert';
  isLoading?: boolean;
  children?: ReactNode;
};

export const AuthCard = ({
  title,
  description,
  descriptionRole,
  isLoading,
  children,
}: AuthCardProps) => (
  <Card className="w-full shadow-lg border-border/50">
    <CardHeader className="pb-4">
      <CardTitle className="text-xl">{title}</CardTitle>
      <CardDescription role={descriptionRole}>{description}</CardDescription>
    </CardHeader>
    {children && <CardContent isLoading={isLoading}>{children}</CardContent>}
  </Card>
);
