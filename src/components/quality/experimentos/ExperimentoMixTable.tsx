'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LaboratorioLoteMaterial, RecipeSnapshot } from '@/types/laboratorioLote';

type Props = {
  materials: LaboratorioLoteMaterial[];
  volumenM3: number;
  recipeSnapshot?: RecipeSnapshot | null;
};

export default function ExperimentoMixTable({ materials, volumenM3, recipeSnapshot }: Props) {
  const snapshotByMaterial = new Map(
    (recipeSnapshot?.materials ?? []).map((m) => [m.material_id, m])
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Material</TableHead>
          <TableHead>Snapshot /m³</TableHead>
          <TableHead>Teórico /m³</TableHead>
          <TableHead>Real (lote)</TableHead>
          <TableHead>Δ%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {materials.map((m) => {
          const snap = snapshotByMaterial.get(m.material_id);
          const expected =
            m.cantidad_teorica != null ? Number(m.cantidad_teorica) * volumenM3 : null;
          const real = m.cantidad_real != null ? Number(m.cantidad_real) : null;
          const delta =
            expected != null && real != null && expected !== 0
              ? ((real - expected) / expected) * 100
              : null;
          return (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.material_type}</TableCell>
              <TableCell className="text-violet-800">{snap?.quantity ?? '—'}</TableCell>
              <TableCell>{m.cantidad_teorica ?? '—'}</TableCell>
              <TableCell>{m.cantidad_real ?? '—'}</TableCell>
              <TableCell className={delta != null && Math.abs(delta) > 5 ? 'text-amber-700 font-medium' : ''}>
                {delta != null ? `${delta.toFixed(1)}%` : '—'}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
