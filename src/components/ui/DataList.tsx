import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DataListItem {
  label: string;
  value: ReactNode;
  align?: 'left' | 'right';
}

interface DataListProps {
  items?: DataListItem[];
  className?: string;
}

export function DataList({ items, className }: DataListProps) {
  const safeItems = Array.isArray(items) ? items : [];
  return (
    <dl className={cn('space-y-3', className)}>
      {safeItems.map((item) => (
        <div key={item.label} className="glass-thin rounded-xl px-4 py-3 flex items-center justify-between">
          <dt className="text-footnote text-gray-500 uppercase tracking-wide">{item.label}</dt>
          <dd className={cn('text-body text-gray-900 font-medium', item.align === 'right' && 'text-right')}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}


