"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { createEnsayo, calcularResistencia, calcularPorcentajeCumplimiento } from '@/services/qualityEnsayoService';
import { updateMuestraEstado } from '@/services/qualityMuestraService';
import { FileUploader } from '@/components/ui/file-uploader';
import { Ensayo, Muestra } from '@/types/quality';
import { format } from 'date-fns';

interface EnsayoFormProps {
  muestraId: string;
  muestraData?: Muestra | null;
  recipeData?: {
    resistencia: number;
    edad_garantia: number;
  } | null;
  tipoMuestra?: 'CILINDRO' | 'VIGA';
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EnsayoForm({ 
  muestraId, 
  muestraData, 
  recipeData, 
  tipoMuestra = 'CILINDRO',
  onSuccess,
  onCancel
}: EnsayoFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cargaKg: '',
    observaciones: '',
    files: [] as File[]
  });
  const [calculatedValues, setCalculatedValues] = useState({
    resistenciaCalculada: 0,
    porcentajeCumplimiento: 0
  });

  // For debugging
  useEffect(() => {
    if (muestraData) {
      console.log('Muestra data:', muestraData);
    }
  }, [muestraData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Calculate resistance and compliance when carga changes
    if (name === 'cargaKg' && value && recipeData) {
      const cargaValue = parseFloat(value);
      if (!isNaN(cargaValue) && cargaValue > 0) {
        calculateResults(cargaValue);
      }
    }
  };

  const handleFileChange = (files: File[]) => {
    setFormData(prev => ({
      ...prev,
      files
    }));
  };

  const calculateResults = async (cargaKg: number) => {
    try {
      if (!recipeData) return;
      
      const resistenciaCalculada = await calcularResistencia(
        tipoMuestra === 'CILINDRO' ? 'FC' : 'MR',
        tipoMuestra,
        cargaKg
      );
      
      const edadEnsayo = muestraData 
        ? calculateAge(muestraData.fecha_programada_ensayo) 
        : recipeData.edad_garantia;
      
      const porcentajeCumplimiento = await calcularPorcentajeCumplimiento(
        resistenciaCalculada,
        recipeData.resistencia,
        edadEnsayo,
        recipeData.edad_garantia
      );
      
      setCalculatedValues({
        resistenciaCalculada,
        porcentajeCumplimiento
      });
    } catch (error) {
      console.error("Error al calcular resultados:", error);
      toast({
        title: "Error",
        description: "No se pudieron calcular los resultados del ensayo",
        variant: "destructive"
      });
    }
  };

  const calculateAge = (dateString: string): number => {
    try {
      if (!dateString) {
        console.warn("Missing fecha_programada_ensayo in calculateAge");
        return recipeData?.edad_garantia || 0;
      }
      
      if (!muestraData) {
        console.warn("Missing muestraData in calculateAge");
        return recipeData?.edad_garantia || 0;
      }
      
      // Use current date as fallback if we don't have muestreo data
      const now = new Date();
      
      // Parse test date
      const testDate = new Date(dateString);
      if (isNaN(testDate.getTime())) {
        console.warn("Invalid test date in calculateAge:", dateString);
        return recipeData?.edad_garantia || 0;
      }
      
      // For safety, validate the testDate is valid
      const isValidDate = !isNaN(testDate.getTime());
      if (!isValidDate) {
        console.warn("Invalid date detected in calculateAge", { testDate, dateString });
        return recipeData?.edad_garantia || 0;
      }
      
      // Calculate difference in days between current date and test date
      const diffTime = Math.abs(testDate.getTime() - now.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      console.log("Age calculation:", { 
        testDate: testDate.toISOString(),
        now: now.toISOString(),
        diffDays
      });
      
      return diffDays;
    } catch (error) {
      console.error("Error calculating age:", error);
      return recipeData?.edad_garantia || 0;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!muestraId) {
      toast({
        title: "Error",
        description: "ID de muestra no válido",
        variant: "destructive"
      });
      return;
    }
    
    const cargaKg = parseFloat(formData.cargaKg);
    if (isNaN(cargaKg) || cargaKg <= 0) {
      toast({
        title: "Error",
        description: "La carga debe ser un número positivo",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Create current date and validate it
      const currentDate = new Date();
      if (isNaN(currentDate.getTime())) {
        throw new Error("Invalid date generated");
      }
      
      // Create test record
      const ensayoData = {
        muestra_id: muestraId,
        fecha_ensayo: currentDate.toISOString(),
        carga_kg: cargaKg,
        resistencia_calculada: calculatedValues.resistenciaCalculada,
        porcentaje_cumplimiento: calculatedValues.porcentajeCumplimiento,
        observaciones: formData.observaciones || undefined
      };
      
      console.log("Submitting ensayo data:", ensayoData);
      
      const ensayo = await createEnsayo(ensayoData);
      
      // Update sample status
      await updateMuestraEstado(muestraId, 'ENSAYADO');
      
      // Upload evidence files if any
      if (formData.files.length > 0) {
        const uploadPromises = formData.files.map(file => {
          // Implement file upload logic here
          // This would typically call your uploadEvidencia function
          console.log("Uploading file:", file.name);
          return Promise.resolve();
        });
        
        await Promise.all(uploadPromises);
      }
      
      toast({
        title: "Ensayo registrado",
        description: "El ensayo ha sido registrado correctamente",
        variant: "default"
      });
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error al registrar ensayo:", error);
      toast({
        title: "Error",
        description: "No se pudo registrar el ensayo. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de Ensayo</CardTitle>
        <CardDescription>
          Complete el formulario para registrar los resultados del ensayo de {tipoMuestra.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {muestraData && (
            <div className="bg-muted p-4 rounded-md mb-4">
              <h4 className="font-medium mb-2">Información de la Muestra</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Identificación:</span>
                  <p className="text-sm">{muestraData.identificacion}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Fecha programada:</span>
                  <p className="text-sm">
                    {muestraData.fecha_programada_ensayo ? 
                      (() => {
                        try {
                          const date = new Date(muestraData.fecha_programada_ensayo);
                          return isNaN(date.getTime()) 
                            ? 'Fecha inválida' 
                            : format(date, 'dd/MM/yyyy');
                        } catch (e) {
                          console.error("Error formatting date:", e);
                          return 'Error en fecha';
                        }
                      })() 
                      : 'No disponible'}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Tipo:</span>
                  <p className="text-sm">{muestraData.tipo_muestra}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="cargaKg">Carga (kg)</Label>
              <Input
                id="cargaKg"
                name="cargaKg"
                type="number"
                step="0.01"
                value={formData.cargaKg}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>Resultado Calculado</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 border rounded-md bg-slate-50">
                  <div className="text-sm text-muted-foreground">Resistencia:</div>
                  <div className="font-medium">
                    {calculatedValues.resistenciaCalculada.toFixed(2)} kg/cm²
                  </div>
                </div>
                <div className="p-3 border rounded-md bg-slate-50">
                  <div className="text-sm text-muted-foreground">Cumplimiento:</div>
                  <div className={`font-medium ${
                    calculatedValues.porcentajeCumplimiento >= 100 
                      ? 'text-green-600' 
                      : calculatedValues.porcentajeCumplimiento >= 90 
                        ? 'text-amber-600' 
                        : 'text-red-600'
                  }`}>
                    {calculatedValues.porcentajeCumplimiento.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              name="observaciones"
              value={formData.observaciones}
              onChange={handleInputChange}
              rows={3}
              placeholder="Ingrese cualquier observación relevante sobre el ensayo"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Evidencias (opcional)</Label>
            <FileUploader
              accept=".jpg,.jpeg,.png,.pdf"
              maxFiles={5}
              maxSize={5 * 1024 * 1024} // 5MB
              onFilesSelected={handleFileChange}
            />
          </div>
          
          <div className="flex justify-end space-x-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.cargaKg}
            >
              {loading ? 'Guardando...' : 'Registrar Ensayo'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 