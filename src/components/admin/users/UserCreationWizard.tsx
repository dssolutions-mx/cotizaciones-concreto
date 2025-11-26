'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { authService } from '@/lib/supabase/auth';
import { usePlantContext } from '@/contexts/PlantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { RolePermissionPreview } from './RolePermissionPreview';
import { PlantSelector } from './PlantSelector';
import { ChevronRight, ChevronLeft, Check, Mail, UserPlus, Shield, Building2 } from 'lucide-react';
import type { UserRole } from '@/store/auth/types';

interface WizardData {
  mode: 'create' | 'invite';
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  plantId: string | null;
  businessUnitId: string | null;
}

const steps = [
  { id: 1, title: 'Tipo de Usuario', icon: UserPlus },
  { id: 2, title: 'Información Básica', icon: Mail },
  { id: 3, title: 'Rol y Permisos', icon: Shield },
  { id: 4, title: 'Asignación', icon: Building2 },
  { id: 5, title: 'Confirmar', icon: Check },
];

export function UserCreationWizard() {
  const router = useRouter();
  const { session } = useAuthBridge();
  const { availablePlants, businessUnits } = usePlantContext();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WizardData>({
    mode: 'create',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'SALES_AGENT',
    plantId: null,
    businessUnitId: null,
  });

  const updateData = (updates: Partial<WizardData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      if (data.mode === 'create') {
        await authService.createUser({
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          callerId: session?.user?.id,
          callerEmail: session?.user?.email,
        });
      } else {
        await authService.inviteUser(data.email, data.role);
      }

      // TODO: Assign plant/business unit if selected

      toast({
        title: 'Éxito',
        description: data.mode === 'create' 
          ? `Usuario ${data.email} creado correctamente`
          : `Invitación enviada a ${data.email}`,
      });

      router.push('/admin/users');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al crear usuario',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return true; // Mode selection always valid
      case 2:
        return data.email && (data.mode === 'invite' || (data.password && data.password.length >= 8));
      case 3:
        return !!data.role;
      case 4:
        return true; // Assignment is optional
      case 5:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                      isActive
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className={`mt-2 text-xs font-medium ${
                    isActive ? 'text-indigo-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="glass-base rounded-xl p-8 border min-h-[400px]">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-2xl font-bold mb-4">Tipo de Usuario</h2>
              <p className="text-gray-600 mb-6">Selecciona cómo deseas crear el usuario</p>
              
              <Tabs value={data.mode} onValueChange={(value) => updateData({ mode: value as 'create' | 'invite' })}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="create">Crear Cuenta</TabsTrigger>
                  <TabsTrigger value="invite">Enviar Invitación</TabsTrigger>
                </TabsList>
                
                <TabsContent value="create" className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      Se creará una cuenta completa con contraseña. El usuario podrá iniciar sesión inmediatamente.
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="invite" className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800">
                      Se enviará un correo de invitación. El usuario deberá configurar su contraseña al aceptar la invitación.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-2xl font-bold mb-4">Información Básica</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Correo Electrónico *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={data.email}
                    onChange={(e) => updateData({ email: e.target.value })}
                    className="mt-1"
                    required
                  />
                </div>

                {data.mode === 'create' && (
                  <div>
                    <Label htmlFor="password">Contraseña *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={data.password}
                      onChange={(e) => updateData({ password: e.target.value })}
                      className="mt-1"
                      minLength={8}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Mínimo 8 caracteres</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">Nombre</Label>
                    <Input
                      id="firstName"
                      value={data.firstName}
                      onChange={(e) => updateData({ firstName: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Apellido</Label>
                    <Input
                      id="lastName"
                      value={data.lastName}
                      onChange={(e) => updateData({ lastName: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-2xl font-bold mb-4">Rol y Permisos</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="role">Rol *</Label>
                  <Select value={data.role} onValueChange={(value) => updateData({ role: value as UserRole })}>
                    <SelectTrigger id="role" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SALES_AGENT">Vendedor</SelectItem>
                      <SelectItem value="EXTERNAL_SALES_AGENT">Vendedor Externo</SelectItem>
                      <SelectItem value="QUALITY_TEAM">Equipo de Calidad</SelectItem>
                      <SelectItem value="PLANT_MANAGER">Jefe de Planta</SelectItem>
                      <SelectItem value="DOSIFICADOR">Dosificador</SelectItem>
                      <SelectItem value="CREDIT_VALIDATOR">Validador de Crédito</SelectItem>
                      <SelectItem value="EXECUTIVE">Directivo</SelectItem>
                      <SelectItem value="ADMIN_OPERATIONS">Admin Operaciones</SelectItem>
                      <SelectItem value="ADMINISTRATIVE">Administrativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <RolePermissionPreview role={data.role} />
              </div>
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-2xl font-bold mb-4">Asignación de Planta</h2>
              <p className="text-gray-600 mb-6">Opcional: Asigna el usuario a una planta o unidad de negocio</p>
              <PlantSelector
                selectedPlantId={data.plantId}
                selectedBusinessUnitId={data.businessUnitId}
                onPlantChange={(plantId) => updateData({ plantId, businessUnitId: null })}
                onBusinessUnitChange={(businessUnitId) => updateData({ businessUnitId, plantId: null })}
              />
            </motion.div>
          )}

          {currentStep === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-2xl font-bold mb-4">Confirmar</h2>
              <div className="space-y-4">
                <div className="glass-thin rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipo:</span>
                    <span className="font-medium">{data.mode === 'create' ? 'Crear Cuenta' : 'Enviar Invitación'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium">{data.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nombre:</span>
                    <span className="font-medium">{data.firstName} {data.lastName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rol:</span>
                    <span className="font-medium">{data.role}</span>
                  </div>
                  {(data.plantId || data.businessUnitId) && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Asignación:</span>
                      <span className="font-medium">
                        {data.plantId 
                          ? availablePlants?.find(p => p.id === data.plantId)?.name
                          : businessUnits?.find(bu => bu.id === data.businessUnitId)?.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>
          
          {currentStep < steps.length ? (
            <Button
              onClick={nextStep}
              disabled={!canProceed() || loading}
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Procesando...' : data.mode === 'create' ? 'Crear Usuario' : 'Enviar Invitación'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

