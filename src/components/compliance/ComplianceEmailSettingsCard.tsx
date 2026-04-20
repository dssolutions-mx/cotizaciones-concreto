'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

type PlantRow = {
  id: string;
  code: string;
  name: string | null;
  isActive: boolean | null;
  persistedOverride: boolean;
  dosificadorEmail: string | null;
  jefePlantaEmail: string | null;
  extraCc: string[];
};

export function ComplianceEmailSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [digest, setDigest] = useState('');
  const [envNote, setEnvNote] = useState('');
  const [plants, setPlants] = useState<PlantRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/compliance/settings');
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'No se pudieron cargar ajustes');
        return;
      }
      setDigest((json.digestRecipients as string) ?? '');
      setEnvNote((json.envFallbackNote as string) ?? '');
      setPlants(json.plants as PlantRow[]);
    } catch {
      toast.error('Error de red al cargar ajustes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updatePlant = (id: string, patch: Partial<PlantRow>) => {
    setPlants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/compliance/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          digestRecipients: digest,
          plants: plants.map((p) => ({
            plantId: p.id,
            persistedOverride: p.persistedOverride,
            dosificadorEmail: p.dosificadorEmail,
            jefePlantaEmail: p.jefePlantaEmail,
            extraCc: p.extraCc,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'No se pudo guardar');
        return;
      }
      toast.success('Destinatarios guardados');
      await load();
    } catch {
      toast.error('Error de red');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-stone-200">
      <CardHeader>
        <CardTitle>Correos: digest y overrides por planta</CardTitle>
        <CardDescription className="space-y-2">
          <p>
            Aquí configuras lo mismo que en <code className="rounded bg-stone-100 px-1 text-xs">COMPLIANCE_OVERRIDES_JSON</code> y{' '}
            <code className="rounded bg-stone-100 px-1 text-xs">COMPLIANCE_DIGEST_RECIPIENTS</code>, pero en base de datos. Los
            dosificadores activos en cotizador siguen yendo siempre en <strong>Para</strong>.
          </p>
          <p className="text-xs text-stone-500">
            Columnas ↔ JSON: <strong>Extra en Para</strong> ={' '}
            <code className="rounded bg-stone-100 px-0.5">dosificador</code> · <strong>Jefe de planta</strong> ={' '}
            <code className="rounded bg-stone-100 px-0.5">jefe_planta</code> · <strong>CC adicionales</strong> ={' '}
            <code className="rounded bg-stone-100 px-0.5">extra_cc</code>. Ejemplo histórico: P001 dosificador; P002
            P001/P002 ejemplo histórico; P004P incluye planta4@ como extra Para por semilla BD.
          </p>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="digest">Resumen matutino (digest)</Label>
          <Input
            id="digest"
            value={digest}
            onChange={(e) => setDigest(e.target.value)}
            placeholder="correo1@empresa.com, correo2@empresa.com"
          />
          <p className="text-xs text-stone-500">
            Solo aplica cuando disparas el run con <code className="rounded bg-stone-100 px-1">notify=1</code>
            (automatización o curl). {envNote}
          </p>
        </div>

        <div className="max-h-[min(420px,50vh)] overflow-auto rounded-md border border-stone-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-stone-100 text-xs uppercase text-stone-600">
              <tr>
                <th className="px-3 py-2">Planta</th>
                <th className="px-3 py-2">
                  Extra en Para
                  <span className="mt-0.5 block font-mono text-[10px] font-normal normal-case text-stone-500">
                    dosificador
                  </span>
                </th>
                <th className="px-3 py-2">
                  Jefe de planta
                  <span className="mt-0.5 block font-mono text-[10px] font-normal normal-case text-stone-500">
                    jefe_planta → CC
                  </span>
                </th>
                <th className="px-3 py-2">
                  CC adicionales
                  <span className="mt-0.5 block font-mono text-[10px] font-normal normal-case text-stone-500">
                    extra_cc[]
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-stone-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : plants.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-stone-500">
                    No hay plantas en cotizador o no se pudo cargar la lista. Revisa la consola de red
                    o vuelve a abrir sesión.
                  </td>
                </tr>
              ) : (
                plants.map((p) => (
                  <tr key={p.id} className="border-t border-stone-100">
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">{p.code}</div>
                      <div className="text-xs text-stone-500">{p.name}</div>
                      {p.isActive === false ? (
                        <span className="text-[10px] text-amber-700">inactiva</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Input
                        className="h-8 text-xs"
                        value={p.dosificadorEmail ?? ''}
                        onChange={(e) => updatePlant(p.id, { dosificadorEmail: e.target.value || null })}
                        placeholder="opcional"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Input
                        className="h-8 text-xs"
                        value={p.jefePlantaEmail ?? ''}
                        onChange={(e) => updatePlant(p.id, { jefePlantaEmail: e.target.value || null })}
                        placeholder="opcional"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Input
                        className="h-8 text-xs"
                        value={(p.extraCc ?? []).join(', ')}
                        onChange={(e) =>
                          updatePlant(p.id, {
                            extraCc: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="a@x.com, b@x.com"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Button type="button" onClick={() => void save()} disabled={saving || loading}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="ml-2">Guardar destinatarios</span>
        </Button>
      </CardContent>
    </Card>
  );
}
