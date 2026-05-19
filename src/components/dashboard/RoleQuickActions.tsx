'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { DashboardQuickAction } from '@/lib/dashboard/dashboard-config';

interface RoleQuickActionsProps {
  actions: DashboardQuickAction[];
}

export function RoleQuickActions({ actions }: RoleQuickActionsProps) {
  if (actions.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-title-3 text-gray-800 mb-3">Accesos rápidos</h2>
      <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-white/50 bg-white/50 p-4 transition-colors hover:bg-white/80"
          >
            <div>
              <p className="font-medium text-gray-900">{action.label}</p>
              {action.description && (
                <p className="text-footnote text-muted-foreground mt-0.5">{action.description}</p>
              )}
            </motion.div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </motion.div>
    </section>
  );
}
