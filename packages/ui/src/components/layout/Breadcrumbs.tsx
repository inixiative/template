import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@template/ui/components/primitives/Breadcrumb';
import { useBreadcrumbs } from '@template/ui/hooks';
import { cn } from '@template/ui/lib/utils';
import { Fragment } from 'react';

export type BreadcrumbsProps = {
  className?: string;
};

export const Breadcrumbs = ({ className }: BreadcrumbsProps) => {
  const { items, onNavigate } = useBreadcrumbs();

  if (items.length === 0) return null;

  return (
    <Breadcrumb className={cn(className)}>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <Fragment key={item.href}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href={item.href}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(item.href);
                    }}
                  >
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
