/**
 * EditUserRoleModal Component
 * Modal for changing a user's role
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { updateTeamMemberRole, TeamMember } from '@/lib/client-portal/teamService';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

interface EditUserRoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
  onSuccess?: () => void;
}

export function EditUserRoleModal({ open, onOpenChange, member, onSuccess }: EditUserRoleModalProps) {
  const [selectedRole, setSelectedRole] = useState<'executive' | 'user'>(member.role_within_client);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Manage focus when modal opens/closes
  useEffect(() => {
    if (open) {
      // Store the previously active element for focus restoration
      previousActiveElementRef.current = document.activeElement as HTMLElement;
      // Focus the first focusable element after modal is rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const modalContent = document.querySelector('[role="dialog"]');
          if (modalContent) {
            const focusableElements = modalContent.querySelectorAll(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const firstElement = focusableElements[0] as HTMLElement;
            if (firstElement) {
              firstElement.focus();
            }
          }
        });
      });
    } else {
      // Restore focus to the previously active element
      if (previousActiveElementRef.current) {
        requestAnimationFrame(() => {
          previousActiveElementRef.current?.focus();
          previousActiveElementRef.current = null;
        });
      }
    }
  }, [open]);

  const handleSubmit = async () => {
    if (selectedRole === member.role_within_client) {
      onOpenChange(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await updateTeamMemberRole(member.user_id, selectedRole);
      toast({
        title: 'Rol actualizado',
        description: `${member.first_name} ${member.last_name} ahora es ${selectedRole === 'executive' ? 'ejecutivo' : 'usuario'}`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error al actualizar rol',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar Rol de Usuario</DialogTitle>
          <DialogDescription>
            Actualiza el rol para {member.first_name} {member.last_name}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <RadioGroup value={selectedRole} onValueChange={(value) => setSelectedRole(value as 'executive' | 'user')}>
            <div className="flex items-start space-x-3 rounded-lg border p-4 mb-3">
              <RadioGroupItem value="executive" id="role-executive" />
              <div className="space-y-1">
                <Label htmlFor="role-executive" className="cursor-pointer">Ejecutivo</Label>
                <p className="text-xs text-gray-600">
                  Acceso completo a todas las funciones, puede gestionar equipo y aprobar pedidos
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 rounded-lg border p-4">
              <RadioGroupItem value="user" id="role-user" />
              <div className="space-y-1">
                <Label htmlFor="role-user" className="cursor-pointer">Usuario</Label>
                <p className="text-xs text-gray-600">
                  Permisos configurables, acceso limitado según configuración
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Actualizar Rol
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
