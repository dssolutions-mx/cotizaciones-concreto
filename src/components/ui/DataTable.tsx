import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DataTableProps {
  headers: ReactNode[];
  children: ReactNode;
  className?: string;
}

export function DataTable({ headers, children, className }: DataTableProps) {
  return (
    <div className={cn('overflow-hidden glass-thick rounded-2xl border border-white/30', className)}>
      <table className="min-w-full divide-y divide-white/40">
        <thead className="bg-white/40">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                scope="col"
                className={cn(
                  'px-4 py-3 text-left text-footnote font-medium text-gray-500 uppercase tracking-wide',
                  index === headers.length - 1 && 'text-right'
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/40 bg-white/60">
          {children}
        </tbody>
      </table>
    </div>
  );
}


