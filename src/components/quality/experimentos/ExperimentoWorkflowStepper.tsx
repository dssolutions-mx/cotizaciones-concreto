'use client';

import React from 'react';
import { FlaskConical, Beaker, TestTube2, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExperimentoWorkflowStep } from '@/lib/quality/experimentoWorkflow';
import type { LaboratorioLoteStatus } from '@/types/laboratorioLote';

const STEPS: { id: ExperimentoWorkflowStep; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'mezcla', label: 'Mezcla', Icon: FlaskConical },
  { id: 'muestreo', label: 'Muestreo', Icon: Beaker },
  { id: 'ensayos', label: 'Ensayos', Icon: TestTube2 },
  { id: 'evaluacion', label: 'Evaluación', Icon: ClipboardCheck },
];

const ORDER: ExperimentoWorkflowStep[] = ['mezcla', 'muestreo', 'ensayos', 'evaluacion'];

type Props = {
  currentStep: ExperimentoWorkflowStep;
  status?: LaboratorioLoteStatus;
  compact?: boolean;
  className?: string;
};

export default function ExperimentoWorkflowStepper({ currentStep, compact, className }: Props) {
  const currentIdx = ORDER.indexOf(currentStep);

  return (
    <nav
      aria-label="Procedimiento de experimento"
      className={cn(
        'flex flex-wrap items-center gap-1 sm:gap-2',
        compact ? 'text-xs' : 'text-sm',
        className
      )}
    >
      {STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = step.id === currentStep;
        const Icon = step.Icon;
        return (
          <React.Fragment key={step.id}>
            {idx > 0 && <span className="text-stone-300 hidden sm:inline">→</span>}
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 border',
                active && 'bg-violet-100 border-violet-300 text-violet-900 font-medium',
                done && !active && 'bg-emerald-50 border-emerald-200 text-emerald-800',
                !active && !done && 'bg-white border-stone-200 text-stone-500'
              )}
            >
              <Icon className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
              <span>{step.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
