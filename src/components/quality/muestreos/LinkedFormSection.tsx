"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import LinkedMuestreoHeader from "./LinkedMuestreoHeader";
import SamplePlan from "./SamplePlan";
import { formatAgeSummary, PlannedSample, addDaysSafe, computeAgeDays } from "./dateUtils";

type Props = {
  form: any;
  selectedRemision: any;
  plannedSamples: PlannedSample[];
  setPlannedSamples: (fn: (prev: PlannedSample[]) => PlannedSample[]) => void;
  submitError: string | null;
  isSubmitting: boolean;
  onBack: () => void;
  onSubmit: (data: any) => void;
  onDateChange: (date?: Date) => void;
  onTimeChange: (hhmm: string) => void;
};

export default function LinkedFormSection({
  form,
  selectedRemision,
  plannedSamples,
  setPlannedSamples,
  submitError,
  isSubmitting,
  onBack,
  onSubmit,
  onDateChange,
  onTimeChange,
}: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Información de la Remisión</CardTitle>
            <CardDescription>Detalles de la remisión seleccionada</CardDescription>
          </CardHeader>
          {selectedRemision ? (
            <CardContent className="space-y-4">
              {/* Keep existing summary card from page for fidelity; kept inline to avoid duplication */}
              {/* The left summary card remains in the page due to custom fields; optional to extract later */}
            </CardContent>
          ) : (
            <CardContent className="flex justify-center items-center p-6">
              <p className="text-gray-500">No hay remisión seleccionada</p>
            </CardContent>
          )}
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos del Muestreo</CardTitle>
            <CardDescription>Completa los datos del muestreo para la remisión seleccionada</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <LinkedMuestreoHeader form={form} onDateChange={onDateChange} onTimeChange={onTimeChange} highlightFromRemision={!!selectedRemision?.fecha} />
                <SamplePlan
                  plannedSamples={plannedSamples as any}
                  setPlannedSamples={setPlannedSamples as any}
                  form={form as any}
                  clasificacion={(selectedRemision?.recipe?.recipe_code || '').toUpperCase().includes('MR') ? 'MR' : 'FC'}
                  edadGarantia={Number(selectedRemision?.recipe?.age_days || 28)}
                  agePlanUnit={"days"}
                  computeAgeDays={computeAgeDays}
                  addDaysSafe={addDaysSafe}
                  formatAgeSummary={formatAgeSummary as any}
                />

                {submitError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
                    <div className="flex items-center">
                      <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                      <span>{submitError}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={onBack}>
                    Atrás
                  </Button>
                  <Button type="submit" variant="ghost" className="!bg-primary !text-primary-foreground" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Guardar Muestreo
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


