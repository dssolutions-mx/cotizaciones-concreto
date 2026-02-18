'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { exportAllBalancesToExcel } from '@/utils/balancesExport';

export function ExportBalancesExcelButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finanzas/balances-export');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const data = await res.json();
      if (!data.rows || !Array.isArray(data.rows)) {
        throw new Error('Formato de respuesta inválido');
      }
      exportAllBalancesToExcel(data.rows);
      toast.success('Excel exportado correctamente');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al exportar';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      {loading ? 'Exportando...' : 'Exportar Excel'}
    </Button>
  );
}
