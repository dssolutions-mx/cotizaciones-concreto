'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { GOVERNANCE_CLIENTS_PATH } from '@/lib/commercial/workflow';

type CalloutVariant = 'info' | 'warning' | 'success';

const variantStyles: Record<CalloutVariant, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  success: 'border-green-200 bg-green-50 text-green-900',
};

interface CommercialWorkflowCalloutProps {
  title?: string;
  children: React.ReactNode;
  variant?: CalloutVariant;
  showGovernanceLink?: boolean;
  governanceLabel?: string;
  className?: string;
}

/** Aviso homogéneo para restricciones del flujo comercial (aprobaciones). */
export function CommercialWorkflowCallout({
  title,
  children,
  variant = 'warning',
  showGovernanceLink = true,
  governanceLabel = 'Finanzas → Autorización de Clientes',
  className,
}: CommercialWorkflowCalloutProps) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-3 text-sm',
        variantStyles[variant],
        className
      )}
    >
      {title ? <p className="font-medium mb-1">{title}</p> : null}
      <div className="text-[0.8125rem] leading-relaxed">{children}</div>
      {showGovernanceLink ? (
        <p className="mt-2 text-[0.8125rem]">
          <Link
            href={GOVERNANCE_CLIENTS_PATH}
            className="font-medium underline underline-offset-2 hover:opacity-90"
          >
            {governanceLabel}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
