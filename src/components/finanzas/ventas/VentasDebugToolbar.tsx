'use client';

import { Button } from '@/components/ui/button';
import { SHOW_VENTAS_DEBUG_TOOL } from '@/lib/finanzas/ventas/ventasDashboardCache';

interface VentasDebugToolbarProps {
  showDebugTool: boolean;
  setShowDebugTool: (v: boolean) => void;
  debugLoading: boolean;
  onRunComparison: () => void;
}

export function VentasDebugToolbar({
  showDebugTool,
  setShowDebugTool,
  debugLoading,
  onRunComparison,
}: VentasDebugToolbarProps) {
  if (!SHOW_VENTAS_DEBUG_TOOL) {
    return (
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div />
      </div>
    );
  }

  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center space-x-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDebugTool(!showDebugTool)}
          className="flex items-center gap-2"
        >
          Debug Tool
        </Button>
        {showDebugTool && (
          <Button
            variant="primary"
            size="sm"
            onClick={onRunComparison}
            disabled={debugLoading}
            className="flex items-center gap-2"
          >
            {debugLoading ? 'Comparando...' : 'Comparar Precios'}
          </Button>
        )}
      </div>
    </div>
  );
}
