"use client";

import { z } from 'zod';

export const siteCheckSchema = z.object({
  mode: z.enum(['linked', 'manual']).default('linked'),
  remision_id: z.string().optional(),
  remision_number_manual: z.string().min(1, 'Número de remisión requerido'),
  plant_id: z.string().uuid('Planta inválida'),
  fecha_muestreo: z.date(),
  hora_salida_planta: z.string().optional(),
  hora_llegada_obra: z.string().optional(),
  test_type: z.enum(['SLUMP','EXTENSIBILIDAD']),
  valor_inicial_cm: z.number().min(0).max(120).nullable().optional(),
  fue_ajustado: z.boolean().default(false),
  detalle_ajuste: z.string().nullable().optional(),
  valor_final_cm: z.number().min(0).max(120).nullable().optional(),
  temperatura_ambiente: z.number().min(-10).max(60).nullable().optional(),
  temperatura_concreto: z.number().min(5).max(60).nullable().optional(),
  observaciones: z.string().nullable().optional(),
});

export type SiteCheckFormValues = z.infer<typeof siteCheckSchema>;
// Raw input type expected by react-hook-form (properties with defaults are optional on input)
export type SiteCheckFormInput = z.input<typeof siteCheckSchema>;

export function validateByType(values: SiteCheckFormInput) {
  const { test_type, valor_inicial_cm, valor_final_cm, fue_ajustado, detalle_ajuste } = values;

  const range = test_type === 'SLUMP' ? { min: 0, max: 25 } : { min: 30, max: 100 };
  const errors: Record<string, string> = {};

  const inRange = (v?: number | null) => v === undefined || v === null || (v >= range.min && v <= range.max);
  if (!inRange(valor_inicial_cm)) errors.valor_inicial_cm = `Valor fuera de rango (${range.min}–${range.max} cm)`;
  if (!inRange(valor_final_cm)) errors.valor_final_cm = `Valor fuera de rango (${range.min}–${range.max} cm)`;

  if (fue_ajustado) {
    if (!detalle_ajuste || detalle_ajuste.trim() === '') errors.detalle_ajuste = 'Describe el ajuste realizado';
    if (valor_final_cm === undefined || valor_final_cm === null) errors.valor_final_cm = 'Captura el valor final después del ajuste';
  }

  return errors;
}


