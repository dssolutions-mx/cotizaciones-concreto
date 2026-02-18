'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { exportClientResearchToExcel } from '@/utils/balancesExport';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';

interface ExportClientResearchButtonProps {
  clientId: string;
}

export function ExportClientResearchButton({ clientId }: ExportClientResearchButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finanzas/balances-export/${clientId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const data = await res.json();
      if (!data.client_id) {
        throw new Error('Formato de respuesta inválido');
      }
      exportClientResearchToExcel(data);
      toast.success('Excel de investigación exportado correctamente');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al exportar';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleProtectedButton
      allowedRoles={['PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR', 'ADMIN_OPERATIONS', 'ADMINISTRATIVE']}
      onClick={handleExport}
      disabled={loading}
      asChild
    >
      <Button variant="outline" size="sm" disabled={loading} className="gap-2">
        <Download className="h-4 w-4" />
        {loading ? 'Exportando...' : 'Exportar investigación'}
      </Button>
    </RoleProtectedButton>
  );
}
