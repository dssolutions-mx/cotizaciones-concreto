import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StackProps {
  children: ReactNode;
  direction?: 'row' | 'column';
  spacing?: 1 | 2 | 3 | 4 | 5 | 6 | 8;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between';
  className?: string;
}

export function Stack({ 
  children, 
  direction = 'column',
  spacing = 4,
  align = 'stretch',
  justify = 'start',
  className = ''
}: StackProps) {
  return (
    <div className={cn(
      'flex',
      direction === 'row' ? 'flex-row' : 'flex-col',
      `gap-${spacing}`,
      `items-${align}`,
      `justify-${justify}`,
      className
    )}>
      {children}
    </div>
  );
}


