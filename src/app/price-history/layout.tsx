import React from 'react';

export const metadata = {
  title: 'Historial de Precios | DC Concretos',
  description: 'Visualización del historial de precios por cliente y receta',
};

export default function PriceHistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
} 