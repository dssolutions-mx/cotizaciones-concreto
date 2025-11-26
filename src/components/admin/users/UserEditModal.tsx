'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { authService } from '@/lib/supabase/auth';
import { useToast } from '@/components/ui/use-toast';
import type { UserRole } from '@/store/auth/types';
import { Shield, Save, X } from 'lucide-react';

interface UserEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: UserRole;
    is_active?: boolean;
  } | null;
  onSuccess: () => void;
}

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'SALES_AGENT', label: 'Vendedor' },
  { value: 'EXTERNAL_SALES_AGENT', label: 'Vendedor Externo' },
  { value: 'QUALITY_TEAM', label: 'Equipo de Calidad' },
  { value: 'PLANT_MANAGER', label: 'Jefe de Planta' },
  { value: 'DOSIFICADOR', label: 'Dosificador' },
  { value: 'CREDIT_VALIDATOR', label: 'Validador de Crédito' },
  { value: 'EXECUTIVE', label: 'Directivo' },
  { value: 'ADMIN_OPERATIONS', label: 'Admin Operaciones' },
  { value: 'ADMINISTRATIVE', label: 'Administrativo' },
];

export function UserEditModal({ open, onOpenChange, user, onSuccess }: UserEditModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<UserRole>('SALES_AGENT');

  useEffect(() => {
    if (user) {
      setRole(user.role);
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    try {
      setLoading(true);
      await authService.updateUserRole(user.id, role);
      
      toast({
        title: 'Éxito',
        description: 'Rol actualizado correctamente',
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al actualizar el rol',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Editar Usuario
          </DialogTitle>
          <DialogDescription>
            Actualiza el rol y la información del usuario
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input
              id="email"
              value={user.email}
              disabled
              className="mt-1 bg-gray-50"
            />
          </div>

          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={`${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Sin nombre'}
              disabled
              className="mt-1 bg-gray-50"
            />
          </div>

          <div>
            <Label htmlFor="role">Rol</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger id="role" className="mt-1">
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

