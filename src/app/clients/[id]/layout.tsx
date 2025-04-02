import { Suspense } from 'react';

export default function ClientDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={
      <div className="container mx-auto p-4 text-center">
        <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-gray-400 rounded-full" role="status">
          <span className="sr-only">Cargando...</span>
        </div>
        <p className="mt-2 text-gray-600">Cargando información del cliente...</p>
      </div>
    }>
      {children}
    </Suspense>
  );
} 