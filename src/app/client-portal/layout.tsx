import { Suspense } from 'react';
import ClientPortalGuard from '@/components/auth/ClientPortalGuard';
import ClientPortalNav from '@/components/client-portal/ClientPortalNav';
import { ClientPortalClientIdHydrator } from '@/components/client-portal/ClientPortalClientIdHydrator';

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClientPortalGuard>
      <Suspense fallback={null}>
        <ClientPortalClientIdHydrator />
      </Suspense>
      <div className="font-system min-h-screen bg-background-primary">
        <ClientPortalNav />
        <main className="max-w-screen-2xl mx-auto px-6 py-12">
          <div className="space-y-8">
            {children}
          </div>
        </main>
      </div>
    </ClientPortalGuard>
  );
}


