'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, MapPin, Users, Activity, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PlantDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantId: string | null;
}

export function PlantDetailModal({ open, onOpenChange, plantId }: PlantDetailModalProps) {
  const [plant, setPlant] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && plantId) {
      // TODO: Fetch plant details
      setLoading(true);
      // Simulate loading
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }
  }, [open, plantId]);

  if (!plantId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Detalles de la Planta
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="info">Información</TabsTrigger>
              <TabsTrigger value="users">Usuarios</TabsTrigger>
              <TabsTrigger value="activity">Actividad</TabsTrigger>
              <TabsTrigger value="settings">Configuración</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="glass-thin rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Código:</span>
                  <span className="font-medium">{plant?.code || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Nombre:</span>
                  <span className="font-medium">{plant?.name || 'N/A'}</span>
                </div>
                {plant?.location && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ubicación:</span>
                    <span className="font-medium flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {plant.location}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Estado:</span>
                  <Badge className={plant?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {plant?.is_active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="users" className="mt-4">
              <div className="glass-thin rounded-lg p-4">
                <p className="text-sm text-gray-500">Lista de usuarios asignados a esta planta</p>
                {/* TODO: Fetch and display users */}
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <div className="glass-thin rounded-lg p-4">
                <p className="text-sm text-gray-500">Actividad reciente de la planta</p>
                {/* TODO: Fetch and display activity */}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="mt-4">
              <div className="glass-thin rounded-lg p-4">
                <p className="text-sm text-gray-500">Configuración de la planta</p>
                {/* TODO: Plant settings */}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

