/**
 * EditPermissionsModal Component
 * Modal for editing a user's permissions
 */

'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateTeamMemberPermissions, TeamMember } from '@/lib/client-portal/teamService';
import { PERMISSION_LABELS, PERMISSION_TEMPLATES, Permissions, PermissionKey } from '@/lib/client-portal/permissionTemplates';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

interface EditPermissionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
  onSuccess?: () => void;
}

export function EditPermissionsModal({ open, onOpenChange, member, onSuccess }: EditPermissionsModalProps) {
  const [permissions, setPermissions] = useState<Permissions>(member.permissions as Permissions);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleTemplateChange = (templateKey: string) => {
    if (templateKey === 'custom') return;
    const template = PERMISSION_TEMPLATES[templateKey as keyof typeof PERMISSION_TEMPLATES];
    if (template) {
      setPermissions(template.permissions);
    }
  };

  const togglePermission = (key: PermissionKey) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await updateTeamMemberPermissions(member.user_id, permissions);
      toast({
        title: 'Permisos actualizados',
        description: `Los permisos para ${member.first_name} ${member.last_name} han sido actualizados`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error al actualizar permisos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const userPermissionKeys: PermissionKey[] = [
    'create_orders',
    'view_orders',
    'create_quotes',
    'view_quotes',
    'view_materials',
    'view_quality_data',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Permisos</DialogTitle>
          <DialogDescription>
            Configura los permisos para {member.first_name} {member.last_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Template Selector */}
          <div className="space-y-2">
            <Label>Plantilla de Permisos</Label>
            <Select onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Elige una plantilla o personaliza" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Personalizado</SelectItem>
                {Object.entries(PERMISSION_TEMPLATES).map(([key, template]) => (
                  <SelectItem key={key} value={key}>
                    {template.name} - {template.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Individual Permissions */}
          <div className="space-y-4">
            <Label className="text-base">Permisos Individuales</Label>
            {userPermissionKeys.map((key) => {
              const config = PERMISSION_LABELS[key];
              return (
                <div key={key} className="flex items-start justify-between space-x-4 rounded-lg border p-4">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={key} className="cursor-pointer">
                      {config.label}
                    </Label>
                    <p className="text-xs text-gray-600">{config.description}</p>
                  </div>
                  <Switch
                    id={key}
                    checked={permissions[key]}
                    onCheckedChange={() => togglePermission(key)}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Permisos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
