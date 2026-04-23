'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface VentasDebugPricingRow {
  remision_id: unknown;
  remision_number: string;
  fecha?: string | null;
  unidad?: string | null;
  tipo_remision?: string | null;
  volumen_fabricado: number;
  recipe_code: string;
  order_id?: unknown;
  sales_report_price: number;
  sales_report_amount: number;
  sales_report_pricing_method: string;
  view_price: number;
  view_amount: number;
  view_pricing_method: string;
  price_difference: number;
  amount_difference: number;
  order_has_pump_service?: boolean;
  is_virtual?: boolean;
  requires_invoice?: boolean;
}

interface VentasDebugPricingCardProps {
  debugLoading: boolean;
  debugData: VentasDebugPricingRow[];
}

export function VentasDebugPricingCard({ debugLoading, debugData }: VentasDebugPricingCardProps) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-red-600">
          🔍 Debug Tool - Comparación de Precios
        </CardTitle>
        <CardDescription>
          Compara los precios calculados por el reporte de ventas vs la vista de base de datos
        </CardDescription>
      </CardHeader>
      <CardContent>
        {debugLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="mb-2 text-lg font-medium">Comparando precios...</div>
              <div className="text-sm text-gray-500">Analizando diferencias entre reporte y vista</div>
            </div>
          </div>
        ) : debugData.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <div className="mb-2 text-lg font-medium">No hay datos de comparación</div>
            <div className="text-sm">Haz clic en &quot;Comparar Precios&quot; para ejecutar el análisis</div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              <Card className="p-4">
                <div className="text-sm text-gray-600">Total Remisiones</div>
                <div className="text-2xl font-bold">{debugData.length}</div>
                <div className="mt-1 text-xs text-gray-500">
                  Concreto: {debugData.filter((d) => d.tipo_remision === 'CONCRETO').length} | Bombeo:{' '}
                  {debugData.filter((d) => d.tipo_remision === 'BOMBEO').length} | Vacío:{' '}
                  {debugData.filter((d) => d.tipo_remision === 'VACÍO DE OLLA').length}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-gray-600">Con Diferencias</div>
                <div className="text-2xl font-bold text-red-600">
                  {debugData.filter((d) => d.price_difference > 0.01).length}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Concreto:{' '}
                  {
                    debugData.filter(
                      (d) => d.tipo_remision === 'CONCRETO' && d.price_difference > 0.01
                    ).length
                  }{' '}
                  | Bombeo:{' '}
                  {
                    debugData.filter(
                      (d) => d.tipo_remision === 'BOMBEO' && d.price_difference > 0.01
                    ).length
                  }
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-gray-600">Diferencia Total</div>
                <div className="text-2xl font-bold text-red-600">
                  ${debugData.reduce((sum, d) => sum + d.amount_difference, 0).toFixed(2)}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Concreto: $
                  {debugData
                    .filter((d) => d.tipo_remision === 'CONCRETO')
                    .reduce((sum, d) => sum + d.amount_difference, 0)
                    .toFixed(2)}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-gray-600">Diferencia Promedio</div>
                <div className="text-2xl font-bold text-red-600">
                  ${(debugData.reduce((sum, d) => sum + d.amount_difference, 0) / debugData.length).toFixed(2)}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Solo Concreto: $
                  {(
                    debugData
                      .filter((d) => d.tipo_remision === 'CONCRETO')
                      .reduce((sum, d) => sum + d.amount_difference, 0) /
                    Math.max(debugData.filter((d) => d.tipo_remision === 'CONCRETO').length, 1)
                  ).toFixed(2)}
                </div>
              </Card>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Remisión</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Volumen</TableHead>
                    <TableHead>Recipe</TableHead>
                    <TableHead>Precio Reporte</TableHead>
                    <TableHead>Precio Vista</TableHead>
                    <TableHead>Diferencia</TableHead>
                    <TableHead>Monto Reporte</TableHead>
                    <TableHead>Monto Vista</TableHead>
                    <TableHead>Diff Monto</TableHead>
                    <TableHead>Método Reporte</TableHead>
                    <TableHead>Método Vista</TableHead>
                    <TableHead>Pump Service</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debugData
                    .filter((d) => d.price_difference > 0.01 || d.amount_difference > 0.01)
                    .sort((a, b) => b.amount_difference - a.amount_difference)
                    .slice(0, 50)
                    .map((item, index) => (
                      <TableRow
                        key={index}
                        className={item.price_difference > 0.01 ? 'bg-red-50' : ''}
                      >
                        <TableCell className="text-sm">
                          {item.fecha
                            ? format(new Date(item.fecha + 'T00:00:00'), 'dd/MM', { locale: es })
                            : 'N/A'}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-semibold">
                          {item.remision_number}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.unidad}</TableCell>
                        <TableCell className="text-sm">{item.tipo_remision}</TableCell>
                        <TableCell className="text-sm">{item.volumen_fabricado}</TableCell>
                        <TableCell className="font-mono text-xs">{item.recipe_code}</TableCell>
                        <TableCell className="font-mono text-sm">
                          ${item.sales_report_price.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">${item.view_price.toFixed(2)}</TableCell>
                        <TableCell className="font-mono text-sm text-red-600">
                          ${item.price_difference.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          ${item.sales_report_amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">${item.view_amount.toFixed(2)}</TableCell>
                        <TableCell className="font-mono text-sm text-red-600">
                          ${item.amount_difference.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs">{item.sales_report_pricing_method}</TableCell>
                        <TableCell className="text-xs">{item.view_pricing_method}</TableCell>
                        <TableCell className="text-sm">
                          {item.order_has_pump_service ? '✅' : '❌'}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>

            {debugData.filter((d) => d.price_difference > 0.01 || d.amount_difference > 0.01)
              .length === 0 && (
              <div className="py-8 text-center text-green-600">
                <div className="mb-2 text-lg font-medium">✅ Perfecto!</div>
                <div className="text-sm">No se encontraron diferencias entre el reporte y la vista</div>
              </div>
            )}

            {debugData.length > 0 &&
              debugData.filter((d) => d.price_difference > 0.01 || d.amount_difference > 0.01)
                .length === 0 && (
                <div className="py-8 text-center text-blue-600">
                  <div className="mb-2 text-lg font-medium">ℹ️ Información de Debug</div>
                  <div className="text-sm">
                    Total comparaciones: {debugData.length}
                    <br />
                    Suma de montos del reporte: $
                    {debugData.reduce((sum, d) => sum + d.sales_report_amount, 0).toFixed(2)}
                    <br />
                    Suma de montos de la vista: $
                    {debugData.reduce((sum, d) => sum + d.view_amount, 0).toFixed(2)}
                    <br />
                    Diferencia calculada: $
                    {Math.abs(
                      debugData.reduce((sum, d) => sum + d.sales_report_amount, 0) -
                        debugData.reduce((sum, d) => sum + d.view_amount, 0)
                    ).toFixed(2)}
                  </div>
                </div>
              )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
