import { Button } from '@template/ui/components/primitives/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@template/ui/components/primitives/Card';

import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';

type NotFoundProps = {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  className?: string;
};

export const NotFound = ({
  title = 'Page not found',
  description = "The page you're looking for doesn't exist.",
  actionLabel = 'Go to dashboard',
  onAction,
  icon,
  className,
}: NotFoundProps) => {
  return (
    <div className={className ?? 'p-8'}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon ?? <Icon icon="lucide:alert-triangle" className="h-4 w-4" />}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{description}</p>
          {onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
        </CardContent>
      </Card>
    </div>
  );
};
