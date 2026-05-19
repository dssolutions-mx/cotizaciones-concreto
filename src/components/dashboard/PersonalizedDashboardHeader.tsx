'use client';

import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Building2, Factory } from 'lucide-react';
import type { RoleDashboardConfig } from '@/lib/dashboard/dashboard-config';
import type { DashboardScope } from '@/lib/dashboard/resolve-dashboard-scope';

interface PersonalizedDashboardHeaderProps {
  firstName?: string | null;
  config: RoleDashboardConfig;
  scope: DashboardScope;
  lastUpdated?: string;
}

export function PersonalizedDashboardHeader({
  firstName,
  config,
  scope,
  lastUpdated,
}: PersonalizedDashboardHeaderProps) {
  const greeting = firstName ? `Hola, ${firstName}` : 'Dashboard';

  return (
    <motion.header
      className="mb-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <p className="text-footnote text-muted-foreground uppercase tracking-wider">
        {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
      </p>
      <motion.div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-footnote font-medium text-primary">{config.roleLabel}</p>
          <h1 className="text-large-title text-gray-900">{greeting}</h1>
          <p className="text-callout text-muted-foreground mt-1 max-w-2xl">{config.subtitle}</p>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-white/50 bg-white/40 px-4 py-3 text-sm text-gray-700">
          {scope.accessLevel === 'BUSINESS_UNIT' ? (
            <Building2 className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          ) : (
            <Factory className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          )}
          <motion.div>
            <p className="font-medium text-gray-900">Tu ámbito</p>
            <p className="text-footnote text-muted-foreground">{scope.scopeLabel}</p>
            {scope.plants.length > 1 && (
              <p className="text-footnote text-muted-foreground mt-1">
                {scope.plants.length} plantas en vista
              </p>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
      {lastUpdated && (
        <p className="text-footnote text-muted-foreground mt-3">
          Última actualización: {new Date(lastUpdated).toLocaleString('es-MX')}
        </p>
      )}
    </motion.header>
  );
}
