import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type GridColumns = '1' | '2' | '3' | '4';

interface GridProps {
  children: ReactNode;
  columns?: GridColumns;
  mdColumns?: GridColumns;
  lgColumns?: GridColumns;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

const columnClass = (prefix: string | null, value?: GridColumns) => {
  if (!value) return null;
  const col = Number(value);
  const base = `grid-cols-${col}`;
  return prefix ? `${prefix}:${base}` : base;
};

const gapClassMap = {
  sm: 'gap-4',
  md: 'gap-6',
  lg: 'gap-8'
} as const;

export function Grid({
  children,
  columns = '1',
  mdColumns,
  lgColumns,
  gap = 'md',
  className
}: GridProps) {
  return (
    <div
      className={cn(
        'grid',
        columnClass(null, columns),
        columnClass('md', mdColumns),
        columnClass('lg', lgColumns),
        gapClassMap[gap],
        className
      )}
    >
      {children}
    </div>
  );
}


