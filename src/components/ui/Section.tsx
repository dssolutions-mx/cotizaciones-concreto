import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({
  title,
  description,
  action,
  children,
  className
}: SectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      {(title || description || action) && (
        <div className="flex items-center justify-between">
          <div>
            {title && <h2 className="text-title-2 text-gray-900 font-semibold">{title}</h2>}
            {description && <p className="text-body text-gray-500 mt-1">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}


