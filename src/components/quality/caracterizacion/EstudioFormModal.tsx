'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// Importar todos los formularios
import GranulometriaForm from './forms/GranulometriaForm';
import DensidadForm from './forms/DensidadForm';
import MasaVolumetricoForm from './forms/MasaVolumetricoForm';
import PerdidaLavadoForm from './forms/PerdidaLavadoForm';
import AbsorcionForm from './forms/AbsorcionForm';

interface EstudioSeleccionado {
  id: string;
  tipo_estudio: string;
  nombre_estudio: string;
  descripcion: string;
  norma_referencia: string;
  estado: 'pendiente' | 'en_proceso' | 'completado';
  fecha_programada: string;
  fecha_completado?: string;
  resultados?: any;
  observaciones?: string;
}

interface EstudioFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  estudio: EstudioSeleccionado;
  onSave: (estudioId: string, resultados: any) => Promise<void>;
}

export default function EstudioFormModal({
  isOpen,
  onClose,
  estudio,
  onSave
}: EstudioFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async (resultados: any) => {
    try {
      setIsLoading(true);
      
      // Obtener el alta_estudio_id del estudio seleccionado
      const { data: estudioData, error: estudioError } = await supabase
        .from('estudios_seleccionados')
        .select('alta_estudio_id')
        .eq('id', estudio.id)
        .single();

      if (estudioError) throw estudioError;

      // Guardar según el tipo de estudio
      if (estudio.nombre_estudio === 'Análisis Granulométrico') {
        // Para granulometría, guardar en tabla granulometrias
        if (resultados.mallas && Array.isArray(resultados.mallas)) {
          // Primero eliminar datos existentes
          await supabase
            .from('granulometrias')
            .delete()
            .eq('alta_estudio_id', estudioData.alta_estudio_id);

          // Insertar nuevos datos
          const granulometriaData = resultados.mallas.map((malla: any, index: number) => ({
            alta_estudio_id: estudioData.alta_estudio_id,
            no_malla: malla.numero_malla,
            retenido: malla.peso_retenido || 0,
            porc_retenido: malla.porcentaje_retenido || 0,
            porc_acumulado: malla.porcentaje_acumulado || 0,
            porc_pasa: malla.porcentaje_pasa || 0,
            orden_malla: index + 1
          }));

          const { error: granError } = await supabase
            .from('granulometrias')
            .insert(granulometriaData);

          if (granError) throw granError;
        }
      } else {
        // Para otros estudios, guardar en tabla caracterizacion
        const updateData: any = {};
        
        switch (estudio.nombre_estudio) {
          case 'Densidad':
            updateData.masa_especifica = resultados.densidad_relativa;
            updateData.masa_especifica_sss = resultados.densidad_sss;
            updateData.masa_especifica_seca = resultados.densidad_aparente;
            updateData.absorcion_porcentaje = resultados.absorcion;
            break;
            
          case 'Masa Volumétrico':
            updateData.masa_volumetrica_suelta = resultados.masa_volumetrica_suelta;
            updateData.masa_volumetrica_compactada = resultados.masa_volumetrica_compactada;
            break;
            
          case 'Pérdida por Lavado':
            updateData.perdida_lavado = resultados.perdida_lavado;
            updateData.perdida_lavado_porcentaje = resultados.porcentaje_perdida;
            break;
            
          case 'Absorción':
            updateData.absorcion = resultados.incremento_peso;
            updateData.absorcion_porcentaje = resultados.absorcion_porcentaje;
            break;
        }

        if (Object.keys(updateData).length > 0) {
          updateData.updated_at = new Date().toISOString();
          
          const { error: caracError } = await supabase
            .from('caracterizacion')
            .update(updateData)
            .eq('alta_estudio_id', estudioData.alta_estudio_id);

          if (caracError) throw caracError;
        }
      }

      // Actualizar el estado del estudio seleccionado
      const { error } = await supabase
        .from('estudios_seleccionados')
        .update({
          resultados: resultados,
          estado: 'completado',
          fecha_completado: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', estudio.id);

      if (error) throw error;

      // Llamar al callback del padre
      await onSave(estudio.id, resultados);
      
      // Cerrar modal
      onClose();
      
    } catch (error) {
      console.error('Error saving estudio:', error);
      throw error; // Re-throw para que el formulario maneje el error
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const renderForm = () => {
    const commonProps = {
      estudioId: estudio.id,
      initialData: estudio.resultados,
      onSave: handleSave,
      onCancel: handleCancel,
      isLoading
    };

    switch (estudio.nombre_estudio) {
      case 'Análisis Granulométrico':
        return <GranulometriaForm {...commonProps} />;
      
      case 'Densidad':
        return <DensidadForm {...commonProps} />;
      
      case 'Masa Volumétrico':
        return <MasaVolumetricoForm {...commonProps} />;
      
      case 'Pérdida por Lavado':
        return <PerdidaLavadoForm {...commonProps} />;
      
      case 'Absorción':
        return <AbsorcionForm {...commonProps} />;
      
      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-500">
              Formulario no disponible para: {estudio.nombre_estudio}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Este tipo de análisis aún no tiene un formulario implementado.
            </p>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <DialogTitle className="text-xl font-semibold">
            {estudio.nombre_estudio}
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Información del estudio */}
          <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-primary">
                  <strong>Descripción:</strong> {estudio.descripcion}
                </p>
              </div>
              <div>
                <p className="text-primary">
                  <strong>Norma:</strong> {estudio.norma_referencia}
                </p>
              </div>
              <div>
                <p className="text-primary">
                  <strong>Estado:</strong> 
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                    estudio.estado === 'completado' ? 'bg-primary/10 text-primary' :
                    estudio.estado === 'en_proceso' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {estudio.estado.charAt(0).toUpperCase() + estudio.estado.slice(1)}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-primary">
                  <strong>Fecha Programada:</strong> {new Date(estudio.fecha_programada).toLocaleDateString('es-MX')}
                </p>
              </div>
            </div>
          </div>

          {/* Formulario específico */}
          <div>
            {renderForm()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
