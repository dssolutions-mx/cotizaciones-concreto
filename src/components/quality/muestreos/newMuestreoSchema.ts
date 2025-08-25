"use client";

import { z } from "zod";

// Validation schema for the New Muestreo form
export const muestreoFormSchema = z.object({
  // Optional in manual capture mode
  remision_id: z.string().optional(),
  manual_reference: z.string().optional(), // For manual remision reference
  fecha_muestreo: z.date({
    required_error: "La fecha de muestreo es requerida",
  }),
  numero_muestreo: z.number().min(1, "El número de muestreo es requerido"),
  planta: z.enum(["P001", "P002", "P003", "P004", "P005"], {
    required_error: "La planta es requerida",
  }),
  revenimiento_sitio: z.number(),
  masa_unitaria: z.number(),
  temperatura_ambiente: z
    .number()
    .min(-10, "Temperatura ambiente mínima -10°C")
    .max(60, "Temperatura ambiente máxima 60°C"),
  temperatura_concreto: z
    .number()
    .min(5, "Temperatura del concreto mínima 5°C")
    .max(60, "Temperatura del concreto máxima 60°C"),
  numero_cilindros: z.number().min(0, "El número de cilindros debe ser un número no negativo"),
  numero_vigas: z.number().min(0, "El número de vigas debe ser un número no negativo"),
  // Recipient-based MU helper inputs (optional)
  peso_recipiente_vacio: z.number().min(0, "Peso vacío debe ser ≥ 0 kg").optional(),
  peso_recipiente_lleno: z.number().min(0, "Peso lleno debe ser ≥ 0 kg").optional(),
  factor_recipiente: z.number().min(0, "Factor debe ser ≥ 0").optional(),
});

export type MuestreoFormValues = z.infer<typeof muestreoFormSchema>;


