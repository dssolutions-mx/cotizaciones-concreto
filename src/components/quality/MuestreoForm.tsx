"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import RemisionesPicker from '@/components/quality/RemisionesPicker';
import { createMuestreo } from '@/services/qualityMuestreoService';
import { crearMuestrasPorEdad } from '@/services/qualityMuestraService';
import { Muestreo } from '@/types/quality';
import { supabase } from '@/lib/supabase';

interface MuestreoFormProps {
  onSuccess?: (muestreoId: string) => void;
  onCancel?: () => void;
}

interface RemisionData {
  id: string;
  fecha: string;
  remision_number: string;
  recipe: {
    recipe_code: string;
    recipe_versions?: Array<{
      notes: string;
    }>;
  };
}

interface RecipeVersion {
  id: string;
  notes?: string;
  is_current: boolean;
}

export function MuestreoForm({ onSuccess, onCancel }: MuestreoFormProps) {
  const { toast } = useToast();
  const [remisionId, setRemisionId] = useState<string | null>(null);
  const [remisionDate, setRemisionDate] = useState<string | null>(null);
  const [recipeDetails, setRecipeDetails] = useState<{ code: string; clasificacion: 'FC' | 'MR'; edadGarantia: number } | null>(null);
  const [formData, setFormData] = useState({
    planta: 'P001' as string,
    revenimientoSitio: '',
    masaUnitaria: '',
    temperaturaAmbiente: '',
    temperaturaConcreto: '',
    cantidadMuestras: 1
  });
  const [loading, setLoading] = useState(false);
  const [showRemisionPicker, setShowRemisionPicker] = useState(true);
  const [plants, setPlants] = useState<Array<{id: string, code: string, name: string}>>([]);

  // Add an effect to log when remisionDate changes
  useEffect(() => {
    console.log('remisionDate state updated:', remisionDate);
  }, [remisionDate]);

  // Load plants dynamically from database
  useEffect(() => {
    const loadPlants = async () => {
      try {
        const { data, error } = await supabase
          .from('plants')
          .select('id, code, name')
          .eq('is_active', true)
          .order('code');
        
        if (error) throw error;
        
        setPlants(data || []);
        
        // Validate and set default plant
        if (data && data.length) {
          const plantExists = data.some(p => p.code === formData.planta);
          if (!plantExists) {
            // Set to first available plant if current doesn't exist
            setFormData(prev => ({ ...prev, planta: data[0].code }));
          }
        }
      } catch (error) {
        console.error('Error loading plants:', error);
      }
    };
    
    loadPlants();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRemisionSelected = async (remision: any) => {
    console.log('MuestreoForm - Selected remision object:', remision);
    console.log('MuestreoForm - Fecha type and value:', typeof remision.fecha, remision.fecha);
    console.log('MuestreoForm - All remision keys:', Object.keys(remision));
    
    // Store the remision ID
    setRemisionId(remision.id);
    
    // Store the remision date from the received object
    if (remision.fecha) {
      console.log('Found remision fecha:', remision.fecha);
      setRemisionDate(remision.fecha);
    } else {
      // Try to find the date field with a different name
      const possibleDateField = remision.date || remision.created_at || remision.delivery_date;
      console.log('No direct fecha field, checking alternatives:', { 
        date: remision.date, 
        created_at: remision.created_at,
        delivery_date: remision.delivery_date
      });
      
      if (possibleDateField) {
        console.log('Using alternative date field:', possibleDateField);
        setRemisionDate(possibleDateField);
      } else {
        console.log('No fecha field in remision object, using current date');
        setRemisionDate(new Date().toISOString().split('T')[0]);
      }
    }
    
    setLoading(true);
    
    try {
      // Fetch remision details to get the recipe information
      const { data, error } = await supabase
        .from('remisiones')
        .select(`
          *,
          recipe:recipes(
            *,
            recipe_versions(*)
          )
        `)
        .eq('id', remision.id)
        .single();
        
      if (error) throw error;
      
      if (data?.recipe) {
        const recipeData = data.recipe;
        const currentVersion = recipeData.recipe_versions?.find((v: RecipeVersion) => v.is_current) || recipeData.recipe_versions?.[0];
        const notes = currentVersion?.notes || '';
        const clasificacion = notes.includes('MR') ? 'MR' : 'FC';
        
        setRecipeDetails({
          code: recipeData.recipe_code,
          clasificacion: clasificacion as 'FC' | 'MR',
          edadGarantia: recipeData.age_days || 28
        });
      } else {
        throw new Error('No se encontró información de la receta');
      }
      
      setShowRemisionPicker(false);
    } catch (error) {
      console.error('Error fetching remision details:', error);
      toast({
        title: "Error",
        description: "No se pudo obtener la información de la remisión",
        variant: "destructive",
      });
      setRemisionId(null);
      setRemisionDate(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!remisionId) {
      toast({
        title: "Error",
        description: "Debe seleccionar una remisión",
        variant: "destructive",
      });
      return;
    }
    
    if (!recipeDetails) {
      toast({
        title: "Error",
        description: "No se pudo determinar la información de la receta",
        variant: "destructive",
      });
      return;
    }
    
    if (!remisionDate) {
      toast({
        title: "Advertencia",
        description: "No se encontró la fecha de la remisión, se usará la fecha actual",
        variant: "default",
      });
    }
    
    setLoading(true);
    
    try {
      // Log the remision date before submission
      console.log('Submitting with remision date:', remisionDate);
      
      // Create muestreo record
      const currentDate = new Date();
      const muestreoData = {
        remision_id: remisionId,
        planta: formData.planta,
        revenimiento_sitio: parseFloat(formData.revenimientoSitio) || 0,
        // Round masa_unitaria to nearest integer (no decimals)
        masa_unitaria: Math.round(parseFloat(formData.masaUnitaria) || 0),
        temperatura_ambiente: parseFloat(formData.temperaturaAmbiente) || 0,
        temperatura_concreto: parseFloat(formData.temperaturaConcreto) || 0,
        fecha_muestreo: remisionDate || currentDate.toISOString().split('T')[0],
        hora_muestreo: currentDate.toTimeString().split(' ')[0], // HH:MM:SS format
      } as Partial<Muestreo>;
      
      console.log('Final muestreo data being sent:', muestreoData);
      
      // Create the muestreo first
      const result = await createMuestreo(muestreoData);
      
      if (result && result.id) {
        // Now creating the correct number of muestras
        for (let i = 0; i < formData.cantidadMuestras; i++) {
          await crearMuestrasPorEdad(
            result.id,
            recipeDetails.clasificacion,
            recipeDetails.edadGarantia,
            1 // Always create just 1 set of test days per sample
          );
        }
        
        toast({
          title: "Muestreo creado",
          description: "El muestreo y sus muestras se han registrado correctamente",
          variant: "default",
        });
        
        if (onSuccess) {
          onSuccess(result.id);
        }
      }
    } catch (error) {
      console.error('Error creating muestreo:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el muestreo. Intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const resetRemision = () => {
    setRemisionId(null);
    setRemisionDate(null);
    setRecipeDetails(null);
    setShowRemisionPicker(true);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Registro de Muestreo</CardTitle>
        <CardDescription>
          Complete el formulario para registrar un nuevo muestreo de concreto
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showRemisionPicker ? (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Seleccione una remisión</h3>
            <RemisionesPicker
              onRemisionSelected={handleRemisionSelected}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="planta">Planta</Label>
                <Select
                  value={formData.planta}
                  onValueChange={(value) => handleSelectChange('planta', value)}
                >
                  <SelectTrigger id="planta">
                    <SelectValue placeholder="Seleccione una planta" />
                  </SelectTrigger>
                                  <SelectContent>
                                    {plants.map((plant) => (
                                      <SelectItem key={plant.id} value={plant.code}>
                                        {plant.name} ({plant.code})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="revenimientoSitio">Revenimiento en sitio (cm)</Label>
                <Input
                  id="revenimientoSitio"
                  name="revenimientoSitio"
                  type="number"
                  step="0.1"
                  value={formData.revenimientoSitio}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="masaUnitaria">Masa unitaria (kg/m³)</Label>
                <Input
                  id="masaUnitaria"
                  name="masaUnitaria"
                  type="number"
                  step="0.1"
                  value={formData.masaUnitaria}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="temperaturaAmbiente">Temperatura ambiente (°C)</Label>
                <Input
                  id="temperaturaAmbiente"
                  name="temperaturaAmbiente"
                  type="number"
                  step="0.1"
                  value={formData.temperaturaAmbiente}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="temperaturaConcreto">Temperatura concreto (°C)</Label>
                <Input
                  id="temperaturaConcreto"
                  name="temperaturaConcreto"
                  type="number"
                  step="0.1"
                  value={formData.temperaturaConcreto}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cantidadMuestras">Cantidad de muestras</Label>
                <Input
                  id="cantidadMuestras"
                  name="cantidadMuestras"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.cantidadMuestras}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              {remisionDate && (
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="fechaMuestreo">Fecha de muestreo (de la remisión)</Label>
                  <div className="p-3 border-2 border-blue-300 rounded-md bg-blue-50 text-blue-900 font-medium flex items-center justify-between">
                    <span>{remisionDate}</span>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        console.log('Manual date reset triggered');
                        // Allow manual reset/change if needed for testing
                        const newDate = prompt('Enter a date (YYYY-MM-DD):', remisionDate);
                        if (newDate) {
                          console.log('Manually changing date to:', newDate);
                          setRemisionDate(newDate);
                        }
                      }}
                    >
                      Editar fecha
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {recipeDetails && (
              <div className="bg-muted p-4 rounded-md">
                <h4 className="font-medium mb-2">Información de la receta</h4>
                <p><span className="font-medium">Código:</span> {recipeDetails.code}</p>
                <p><span className="font-medium">Clasificación:</span> {recipeDetails.clasificacion}</p>
                <p><span className="font-medium">Edad de garantía:</span> {recipeDetails.edadGarantia} días</p>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={resetRemision}
                  className="mt-2"
                >
                  Cambiar remisión
                </Button>
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar muestreo'}
              </Button>
            </div>
            
            {/* Dev debugging section - remove in production */}
            <div className="mt-4 p-4 border border-dashed border-gray-300 rounded bg-gray-50">
              <details>
                <summary className="cursor-pointer text-sm text-gray-500 font-medium">Debug info</summary>
                <div className="mt-2 text-xs font-mono whitespace-pre overflow-x-auto">
                  <p><strong>remisionId:</strong> {remisionId}</p>
                  <p><strong>remisionDate:</strong> {remisionDate}</p>
                  <p><strong>formData:</strong> {JSON.stringify(formData, null, 2)}</p>
                </div>
              </details>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
} 