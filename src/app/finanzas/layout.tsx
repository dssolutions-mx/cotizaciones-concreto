import { ReactNode } from 'react';

export const metadata = {
  title: 'Centro Financiero - Cotizaciones Concreto',
  description: 'Visualiza información financiera, balances de clientes y métricas de pagos.',
};

export default function FinanzasLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="py-8">
      {children}
    </main>
  );
} 