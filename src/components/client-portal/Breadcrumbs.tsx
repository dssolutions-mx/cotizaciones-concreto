'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Breadcrumbs() {
  const pathname = usePathname() || '/client-portal';

  // Don't show breadcrumbs on main dashboard page
  if (pathname === '/client-portal') {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);

  const items = [] as { href: string; label: string }[];
  let acc = '';
  for (const seg of segments) {
    acc += '/' + seg;
    items.push({ href: acc, label: toTitle(seg) });
  }

  return (
    <nav className="mb-8" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2 text-footnote">
        <li>
          <Link
            href="/client-portal"
            className="text-label-secondary hover:text-label-primary transition-colors duration-200"
          >
            Dashboard
          </Link>
        </li>
        {items
          .filter(i => i.href !== '/client-portal')
          .map((item, idx) => (
            <li key={item.href} className="flex items-center">
              <span className="text-label-tertiary mx-2">/</span>
              {idx === items.length - 1 ? (
                <span className="font-semibold text-label-primary">{item.label}</span>
              ) : (
                <Link
                  href={item.href}
                  className="text-label-secondary hover:text-label-primary transition-colors duration-200"
                >
                  {item.label}
                </Link>
              )}
            </li>
          ))}
      </ol>
    </nav>
  );
}

function toTitle(seg: string) {
  return seg
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}


