'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { BarChart3, TrendingUp, Package, DollarSign, ArrowRight, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DateRange } from "react-day-picker";
import { DateRangePickerWithPresets } from "@/components/ui/date-range-picker-with-presets"
import Link from 'next/link';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

// Types for comparative production data
interface PlantProductionData {
  plant_id: string;
  plant_code: string;
  plant_name: string;
  total_volume: number;
  total_material_cost: number;
  cement_consumption: number;
  cement_cost_per_m3: number;
  avg_cost_per_m3: number;
  remisiones_count: number;
}

interface ComparativeData {
  section1: PlantProductionData[];  // Consumo
  section2: PlantProductionData[];  // Precios MP
  section3: PlantProductionData[];  // Costo Total MP
  section4: PlantProductionData[];  // Rendimientos
}

export default function ComparativaProduccion() {
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [comparativeData, setComparativeData] = useState<ComparativeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availablePlants, setAvailablePlants] = useState<Array<{ id: string; code: string; name: string }>>([]);

  // Format the dates for display
  const dateRangeText = useMemo(() => {
    if (!startDate || !endDate) return 'Seleccione un rango de fechas';
    return `${format(startDate, 'dd/MM/yyyy', { locale: es })} - ${format(endDate, 'dd/MM/yyyy', { locale: es })}`;
  }, [startDate, endDate]);

  // Fetch available plants
  useEffect(() => {
    async function fetchPlants() {
      try {
        const { data: plants, error: plantsError } = await supabase
          .from('plants')
          .select('id, code, name')
          .eq('is_active', true)
          .order('code');

        if (plantsError) throw plantsError;
        setAvailablePlants(plants || []);
      } catch (error) {
        console.error('Error fetching plants:', error);
      }
    }

    fetchPlants();
  }, []);

  // Fetch comparative production data
  useEffect(() => {
    async function fetchComparativeData() {
      if (!startDate || !endDate || availablePlants.length === 0) {
        setComparativeData(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const formattedStartDate = format(startDate, 'yyyy-MM-dd');
        const formattedEndDate = format(endDate, 'yyyy-MM-dd');

        const plantData: PlantProductionData[] = [];

        // Fetch data for each plant
        for (const plant of availablePlants) {
          const plantProduction = await fetchPlantProductionData(
            plant.id,
            plant.code,
            plant.name,
            formattedStartDate,
            formattedEndDate
          );
          if (plantProduction) {
            plantData.push(plantProduction);
          }
        }

        // Organize data into sections like the reference image
        const comparative: ComparativeData = {
          section1: plantData, // Consumo (Volume and cement consumption)
          section2: plantData, // Precios MP (Material prices)
          section3: plantData, // Costo Total MP (Total material costs)
          section4: plantData  // Rendimientos (Performance metrics)
        };

        setComparativeData(comparative);

      } catch (error) {
        console.error('Error fetching comparative data:', error);
        setError('Error al cargar los datos comparativos. Por favor, intente nuevamente.');
      } finally {
        setLoading(false);
      }
    }

    fetchComparativeData();
  }, [startDate, endDate, availablePlants]);

  // Fetch production data for a specific plant
  const fetchPlantProductionData = async (
    plantId: string,
    plantCode: string,
    plantName: string,
    startDateStr: string,
    endDateStr: string
  ): Promise<PlantProductionData | null> => {
    try {
      // Fetch remisiones for this plant
      const { data: remisiones, error: remisionesError } = await supabase
        .from('remisiones')
        .select(`
          id,
          volumen_fabricado,
          recipe_id,
          recipes!inner(
            id,
            recipe_code,
            strength_fc
          )
        `)
        .eq('tipo_remision', 'CONCRETO')
        .eq('plant_id', plantId)
        .gte('fecha', startDateStr)
        .lte('fecha', endDateStr);

      if (remisionesError) throw remisionesError;

      if (!remisiones || remisiones.length === 0) {
        return {
          plant_id: plantId,
          plant_code: plantCode,
          plant_name: plantName,
          total_volume: 0,
          total_material_cost: 0,
          cement_consumption: 0,
          cement_cost_per_m3: 0,
          avg_cost_per_m3: 0,
          remisiones_count: 0
        };
      }

      const totalVolume = remisiones.reduce((sum, r) => sum + (r.volumen_fabricado || 0), 0);
      const remisionIds = remisiones.map(r => r.id);

      // Fetch material costs for these remisiones
      const materialCosts = await calculateMaterialCosts(remisionIds, totalVolume);

      return {
        plant_id: plantId,
        plant_code: plantCode,
        plant_name: plantName,
        total_volume: totalVolume,
        total_material_cost: materialCosts.totalCost,
        cement_consumption: materialCosts.cementConsumption,
        cement_cost_per_m3: totalVolume > 0 ? materialCosts.cementCost / totalVolume : 0,
        avg_cost_per_m3: totalVolume > 0 ? materialCosts.totalCost / totalVolume : 0,
        remisiones_count: remisiones.length
      };

    } catch (error) {
      console.error(`Error fetching data for plant ${plantCode}:`, error);
      return null;
    }
  };

  // Calculate material costs for remisiones
  const calculateMaterialCosts = async (remisionIds: string[], totalVolume: number) => {
    let totalCost = 0;
    let cementConsumption = 0;
    let cementCost = 0;

    try {
      // Fetch material consumption and costs
      const { data: materials, error: materialsError } = await supabase
        .from('remision_materiales')
        .select(`
          quantity_used,
          material_prices!inner(
            price_per_unit,
            materials!inner(
              name,
              category,
              unit_of_measure
            )
          )
        `)
        .in('remision_id', remisionIds);

      if (materialsError) throw materialsError;

      materials?.forEach((material: any) => {
        const quantity = material.quantity_used || 0;
        const pricePerUnit = material.material_prices?.price_per_unit || 0;
        const materialName = material.material_prices?.materials?.name || '';
        const cost = quantity * pricePerUnit;

        totalCost += cost;

        // Check if it's cement
        if (materialName.toLowerCase().includes('cemento') || 
            materialName.toLowerCase().includes('cement')) {
          cementConsumption += quantity;
          cementCost += cost;
        }
      });

    } catch (error) {
      console.error('Error calculating material costs:', error);
    }

    return {
      totalCost,
      cementConsumption,
      cementCost
    };
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setStartDate(range.from);
      setEndDate(range.to);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Análisis Comparativo de Plantas</h1>
          <p className="text-muted-foreground mt-2">
            Comparación de rendimiento y costos entre plantas - {dateRangeText}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePickerWithPresets
            date={{ from: startDate, to: endDate }}
            onDateChange={handleDateRangeChange}
          />
        </div>
      </div>

      {error && (
        <Alert className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Quick access to detailed analysis */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Análisis Detallado por Planta</h3>
              <p className="text-sm text-muted-foreground">
                Accede al análisis completo con desglose de materiales y tendencias
              </p>
            </div>
            <Link href="/finanzas/produccion/detalle">
              <Button variant="outline" className="gap-2">
                <Eye className="h-4 w-4" />
                Ver Análisis Detallado
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {comparativeData && (
        <div className="space-y-8">
          {/* Sección 1: Consumo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Consumo
              </CardTitle>
              <CardDescription>
                Volumen total producido y consumo de cemento por planta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Planta</TableHead>
                    <TableHead>Volumen Total (m³)</TableHead>
                    <TableHead>Cemento (kg)</TableHead>
                    <TableHead>Aditivo (kg)</TableHead>
                    <TableHead>Agua (L)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparativeData.section1.map((plant) => (
                    <TableRow key={plant.plant_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{plant.plant_code}</div>
                          <div className="text-sm text-muted-foreground">{plant.plant_name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {plant.total_volume.toLocaleString('es-MX', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </Badge>
                      </TableCell>
                      <TableCell>{plant.cement_consumption.toLocaleString('es-MX')}</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Sección 2: Precios MP */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Precios MP
              </CardTitle>
              <CardDescription>
                Precios promedio de materias primas por planta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Planta</TableHead>
                    <TableHead>Volumen Total (m³)</TableHead>
                    <TableHead>Cemento</TableHead>
                    <TableHead>Agregado</TableHead>
                    <TableHead>Aditivo</TableHead>
                    <TableHead>Agua</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparativeData.section2.map((plant) => (
                    <TableRow key={plant.plant_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{plant.plant_code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {plant.total_volume.toLocaleString('es-MX', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(plant.cement_cost_per_m3)}
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Sección 3: Costo Total MP */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Costo Total MP
              </CardTitle>
              <CardDescription>
                Costo total de materias primas por planta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Planta</TableHead>
                    <TableHead>Volumen Total (m³)</TableHead>
                    <TableHead>Cemento</TableHead>
                    <TableHead>Agregado</TableHead>
                    <TableHead>Aditivo</TableHead>
                    <TableHead>Agua</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparativeData.section3.map((plant) => (
                    <TableRow key={plant.plant_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{plant.plant_code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {plant.total_volume.toLocaleString('es-MX', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(plant.total_material_cost)}
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Sección 4: Rendimientos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Rendimientos
              </CardTitle>
              <CardDescription>
                Métricas de rendimiento y eficiencia por planta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Planta</TableHead>
                    <TableHead>Total $ Materia Prima</TableHead>
                    <TableHead>Total $ Materia Prima / m³</TableHead>
                    <TableHead>Cemento / m³</TableHead>
                    <TableHead>$ Cemento / m³</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparativeData.section4.map((plant) => (
                    <TableRow key={plant.plant_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{plant.plant_code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(plant.total_material_cost)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(plant.avg_cost_per_m3)}
                      </TableCell>
                      <TableCell>
                        {plant.total_volume > 0 
                          ? (plant.cement_consumption / plant.total_volume).toLocaleString('es-MX', { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            })
                          : '0.00'
                        } kg/m³
                      </TableCell>
                      <TableCell>
                        {formatCurrency(plant.cement_cost_per_m3)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {(!comparativeData || comparativeData.section1.length === 0) && !loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">Sin datos de producción</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No se encontraron datos de producción para el rango de fechas seleccionado.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
