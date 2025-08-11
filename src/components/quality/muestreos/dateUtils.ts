"use client";

import { formatDate, createSafeDate } from "@/lib/utils";

export const adjustDateForTimezone = (dateInput: string | Date) => {
  if (!dateInput) return null as Date | null;
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const correctedDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  return correctedDate;
};

export const toLocalMidday = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);

export const addDaysSafe = (base: Date, days: number) => {
  const result = new Date(base);
  result.setDate(result.getDate() + (isFinite(days) ? days : 0));
  return result;
};

export const computeAgeDays = (base: Date, target: Date) => {
  const baseMid = toLocalMidday(base);
  const targetMid = toLocalMidday(target);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((targetMid.getTime() - baseMid.getTime()) / msPerDay);
};

export type PlannedSample = {
  id: string;
  tipo_muestra: "CILINDRO" | "VIGA" | "CUBO";
  fecha_programada_ensayo: Date;
  diameter_cm?: number;
  cube_side_cm?: number;
  age_days?: number;
  age_hours?: number;
};

export const formatAgeSummary = (samples: PlannedSample[], baseDate?: Date | null) => {
  if (!baseDate || !samples?.length) return "";
  const counts: Record<number, number> = {};
  samples.forEach((s) => {
    const age = typeof s.age_days === "number" ? s.age_days : computeAgeDays(baseDate, s.fecha_programada_ensayo);
    counts[age] = (counts[age] || 0) + 1;
  });
  const parts = Object.entries(counts)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([age, count]) => `${age}d × ${count}`);
  return parts.join(", ");
};

export function buildProgrammedDateFromAge(baseDateStr: string, s: PlannedSample): Date {
  const base = createSafeDate(baseDateStr)!;
  if (typeof s.age_hours === "number" && isFinite(s.age_hours)) {
    const byHours = new Date(base);
    byHours.setHours(byHours.getHours() + s.age_hours);
    return byHours;
  }
  if (typeof s.age_days === "number" && isFinite(s.age_days)) {
    const byDays = new Date(base);
    byDays.setDate(byDays.getDate() + s.age_days);
    return byDays;
  }
  return s.fecha_programada_ensayo;
}


