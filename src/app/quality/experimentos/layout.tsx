import type { ReactNode } from 'react';
import QualityHubShell from '@/components/quality/QualityHubShell';
import ExperimentoSubNav from '@/components/quality/experimentos/ExperimentoSubNav';

export default function ExperimentosLayout({ children }: { children: ReactNode }) {
  return (
    <QualityHubShell>
      <ExperimentoSubNav />
      {children}
    </QualityHubShell>
  );
}
