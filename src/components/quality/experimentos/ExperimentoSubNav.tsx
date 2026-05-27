'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  {
    href: '/quality/experimentos',
    label: 'Lotes',
    match: (p: string) =>
      p === '/quality/experimentos' ||
      (p.startsWith('/quality/experimentos/') && !p.startsWith('/quality/experimentos/new')),
  },
  {
    href: '/quality/experimentos/new',
    label: 'Nuevo',
    match: (p: string) => p === '/quality/experimentos/new',
  },
];

export default function ExperimentoSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 border-b border-stone-200 pb-3 mb-4">
      {links.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-violet-100 text-violet-900'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            )}
          >
            {link.label}
          </Link>
        );
      })}
      <span className="ml-auto text-xs text-stone-500 hidden sm:inline">
        Mezcla → muestreo → ensayos → evaluación
      </span>
    </div>
  );
}
