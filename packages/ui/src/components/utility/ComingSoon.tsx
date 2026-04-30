import { Card, CardContent, CardHeader, CardTitle } from '@template/ui/components/primitives/Card';

import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';

type ComingSoonProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  className?: string;
};

export const ComingSoon = ({ title, description, icon, className }: ComingSoonProps) => {
  return (
    <div className={className ?? 'p-8'}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon ?? <Icon icon="lucide:construction" className="h-4 w-4" />}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
};
