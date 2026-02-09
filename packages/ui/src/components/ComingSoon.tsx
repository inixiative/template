import { Card, CardContent, CardHeader, CardTitle } from '@template/ui/components/Card';
import { Construction } from 'lucide-react';
import type { ReactNode } from 'react';

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
            {icon ?? <Construction className="h-4 w-4" />}
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
