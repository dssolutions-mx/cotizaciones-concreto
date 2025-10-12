'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  alta_estudio_id?: string;
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
  const [normaCorregida, setNormaCorregida] = useState<string>(estudio.norma_referencia);

  // Corregir la norma para Absorción basándose en el tipo de material
  useEffect(() => {
    const corregirNorma = async () => {
      if (estudio.nombre_estudio === 'Absorción' && isOpen) {
        try {
          // Obtener información del material desde alta_estudio
          const altaEstudioId = estudio.alta_estudio_id;
          if (!altaEstudioId) return;

          const { data: altaEstudioData, error } = await supabase
            .from('alta_estudio')
            .select('tipo_material')
            .eq('id', altaEstudioId)
            .single();

          if (error) {
            console.error('Error loading material info:', error);
            return;
          }

          const tipo = altaEstudioData?.tipo_material?.toLowerCase() || '';
          
          // Determinar la norma según el tipo de material
          let norma = 'NMX-C-164 / NMX-C-165';
          if (tipo.includes('arena') || tipo.includes('fino')) {
            norma = 'NMX-C-165-ONNCCE-2020';
          } else if (tipo.includes('grava') || tipo.includes('grueso')) {
            norma = 'NMX-C-164-ONNCCE-2014';
          }
          
          setNormaCorregida(norma);
        } catch (error) {
          console.error('Error corrigiendo norma:', error);
        }
      }
    };

    corregirNorma();
  }, [estudio.nombre_estudio, estudio.alta_estudio_id, isOpen]);

  const handleSave = async (resultados: any) => {
    try {
      setIsLoading(true);

      // Actualizar el estado del estudio seleccionado
      // Todos los datos se guardan en la columna resultados (JSONB)
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
      
      // Mostrar mensaje de éxito
      toast.success('Estudio guardado exitosamente');
      
      // Cerrar modal
      onClose();
      
    } catch (error: any) {
      console.error('Error saving estudio:', error);
      const errorMessage = error?.message || error?.error?.message || 'Error desconocido al guardar';
      toast.error(`Error al guardar: ${errorMessage}`);
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
      isLoading,
      altaEstudioId: estudio.alta_estudio_id
    };

    switch (estudio.nombre_estudio) {
      case 'Análisis Granulométrico':
        return <GranulometriaForm {...commonProps} />;
      
      case 'Densidad':
        return <DensidadForm {...commonProps} />;
      
      case 'Masa Volumétrica':
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
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {estudio.nombre_estudio}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Información del estudio */}
          <div className="bg-[#069e2d]/5 p-4 rounded-lg border border-[#069e2d]/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[#069e2d]">
                  <strong>Descripción:</strong> {estudio.descripcion}
                </p>
              </div>
              <div>
                <p className="text-[#069e2d]">
                  <strong>Norma:</strong> {normaCorregida}
                </p>
              </div>
              <div>
                <p className="text-[#069e2d]">
                  <strong>Estado:</strong> 
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                    estudio.estado === 'completado' ? 'bg-[#069e2d]/10 text-[#069e2d]' :
                    estudio.estado === 'en_proceso' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {estudio.estado.charAt(0).toUpperCase() + estudio.estado.slice(1)}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[#069e2d]">
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
