'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { recipeService } from '@/lib/supabase/recipes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePlantContext } from '@/contexts/PlantContext';
import { useToast } from '@/components/ui/use-toast';

export default function SuppliersPage() {
  const { availablePlants, currentPlant } = usePlantContext();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ name: '', provider_number: '', plant_id: '' as string | '' , is_active: true, provider_letter: '', internal_code: '' });

  const currentPlantId = currentPlant?.id || '';

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await recipeService.getSuppliers(currentPlantId);
      setSuppliers(data);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudieron cargar los proveedores',
        description: e instanceof Error ? e.message : 'Intenta de nuevo más tarde.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentPlantId) return;
    load();
  }, [currentPlantId]);

  const handleCreate = async () => {
    const providerNumber = parseInt(form.provider_number, 10);
    const plantId = form.plant_id || currentPlantId;

    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'Nombre requerido', description: 'Ingresa el nombre del proveedor.' });
      return;
    }

    if (!Number.isInteger(providerNumber) || providerNumber < 1 || providerNumber > 99) {
      toast({
        variant: 'destructive',
        title: 'Número de proveedor inválido',
        description: 'Debe ser un entero entre 1 y 99.'
      });
      return;
    }

    if (!plantId) {
      toast({ variant: 'destructive', title: 'Selecciona una planta', description: 'Debes seleccionar una planta válida.' });
      return;
    }

    try {
      await recipeService.createSupplier({
        name: form.name.trim(),
        provider_number: providerNumber,
        plant_id: plantId,
        is_active: form.is_active,
        provider_letter: form.provider_letter,
        internal_code: form.internal_code,
      });
      setForm({ name: '', provider_number: '', plant_id: '', is_active: true, provider_letter: '', internal_code: '' });
      toast({ variant: 'success', title: 'Proveedor creado' });
      await load();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudo crear el proveedor',
        description: e instanceof Error ? e.message : 'Revisa los datos e intenta de nuevo.'
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Proveedores</h1>

      <div className="rounded-md border p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
        <div>
          <Label>Nombre</Label>
          <Input value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} />
        </div>
        <div>
          <Label>No. Proveedor</Label>
          <Input type="number" min={1} max={99} value={form.provider_number} onChange={(e) => setForm(prev => ({ ...prev, provider_number: e.target.value }))} />
        </div>
        <div>
          <Label>Letra</Label>
          <Input maxLength={1} value={form.provider_letter} onChange={(e) => setForm(prev => ({ ...prev, provider_letter: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') }))} />
        </div>
        <div>
          <Label>Código Interno</Label>
          <Input value={form.internal_code} onChange={(e) => setForm(prev => ({ ...prev, internal_code: e.target.value }))} />
        </div>
        <div>
          <Label>Planta</Label>
          <Select value={form.plant_id || currentPlantId} onValueChange={(v) => setForm(prev => ({ ...prev, plant_id: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availablePlants.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end justify-between">
          <div className="flex items-center space-x-2">
            <Switch checked={form.is_active} onCheckedChange={(c) => setForm(prev => ({ ...prev, is_active: c }))} />
            <Label>Activo</Label>
          </div>
          <Button onClick={handleCreate}>Agregar</Button>
        </div>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="text-left p-2">Proveedor</th>
              <th className="text-left p-2">Número</th>
              <th className="text-left p-2">Planta</th>
              <th className="text-left p-2">Letra</th>
              <th className="text-left p-2">Código Interno</th>
              <th className="text-left p-2">Activo</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="p-2" colSpan={6}>Cargando...</td></tr>
            ) : suppliers.length === 0 ? (
              <tr><td className="p-2" colSpan={6}>Sin proveedores</td></tr>
            ) : (
              suppliers.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="p-2">{s.name}</td>
                  <td className="p-2 font-mono">{s.provider_number}</td>
                  <td className="p-2">{availablePlants.find(p => p.id === s.plant_id)?.code || '-'}</td>
                  <td className="p-2">{s.provider_letter || '-'}</td>
                  <td className="p-2">{s.internal_code || '-'}</td>
                  <td className="p-2">{s.is_active ? 'Sí' : 'No'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


