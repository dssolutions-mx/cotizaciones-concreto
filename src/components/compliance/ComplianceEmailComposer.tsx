'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { ComplianceRuleId } from '@/lib/compliance/run';

interface EmailComposerProps {
  open: boolean;
  onClose: () => void;
  onSent: (disputeId: string | null, to: string[], cc: string[]) => void;
  plantCode: string;
  category: ComplianceRuleId;
  date: string;
}

const CATEGORY_LABELS: Partial<Record<ComplianceRuleId, string>> = {
  missingProduction: 'Sin remisiones CONCRETO',
  missingMaterialEntries: 'Sin entradas de material',
  missingEvidence: 'Evidencia faltante',
  missingPumping: 'Bombeo faltante',
  missingChecklist: 'Checklist faltante',
  operatorMismatch: 'Conductor ≠ operador',
  unknownUnit: 'Unidad no registrada',
};

function ChipInput({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim().toLowerCase();
    if (v && v.includes('@') && !values.includes(v)) {
      onChange([...values, v]);
    }
    setDraft('');
  };

  const remove = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1 rounded-md border border-stone-200 bg-white p-2 min-h-[42px]">
        {values.map((v, i) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-700"
          >
            {v}
            <button
              type="button"
              className="text-stone-400 hover:text-stone-700"
              onClick={() => remove(i)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className="min-w-[160px] flex-1 bg-transparent text-xs outline-none placeholder:text-stone-400"
          placeholder="correo@ejemplo.com"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
        />
        {draft.trim() && (
          <button type="button" onClick={add} className="text-stone-400 hover:text-stone-700">
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="text-xs text-stone-400">Enter o coma para agregar</p>
    </div>
  );
}

export function ComplianceEmailComposer({
  open,
  onClose,
  onSent,
  plantCode,
  category,
  date,
}: EmailComposerProps) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState('');
  const [note, setNote] = useState('');
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [previewHtml, setPreviewHtml] = useState('');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open) return;
    setTab('edit');
    setNote('');
    setLoading(true);

    fetch(
      `/api/compliance/daily/dispute/preview?date=${encodeURIComponent(date)}&plantCode=${encodeURIComponent(plantCode)}&category=${encodeURIComponent(category)}`,
    )
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          toast.error(json.error);
          onClose();
          return;
        }
        setSubject(json.subject ?? '');
        setPreviewHtml(json.html ?? '');
        setTo(json.to ?? []);
        setCc(json.cc ?? []);
      })
      .catch(() => {
        toast.error('Error al cargar vista previa');
        onClose();
      })
      .finally(() => setLoading(false));
  }, [open, date, plantCode, category, onClose]);

  const handleSend = async () => {
    if (to.length === 0) {
      toast.error('Agrega al menos un destinatario en "Para"');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/compliance/daily/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: date, plantCode, category, subject, note, to, cc }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'No se pudo enviar');
        return;
      }
      onSent(json.disputeId ?? null, json.to ?? to, json.cc ?? cc);
      onClose();
    } catch {
      toast.error('Error de red');
    } finally {
      setSending(false);
    }
  };

  // Update iframe srcdoc with note prepended when switching to preview tab
  const computedHtml = note.trim()
    ? `<blockquote style="border-left:4px solid #f59e0b;margin:0 0 16px 0;padding:8px 16px;background:#fffbeb;color:#92400e;font-style:italic">${note.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</blockquote>\n${previewHtml}`
    : previewHtml;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-stone-200 px-6 py-4">
          <DialogTitle className="text-base">
            {CATEGORY_LABELS[category] ?? category} — {plantCode} — {date}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
          </div>
        ) : (
          <>
            {/* Tab bar */}
            <div className="flex border-b border-stone-200 px-6">
              {(['edit', 'preview'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    tab === t
                      ? 'border-stone-900 text-stone-900'
                      : 'border-transparent text-stone-500 hover:text-stone-700'
                  }`}
                  onClick={() => setTab(t)}
                >
                  {t === 'edit' ? 'Editar' : 'Vista previa'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {tab === 'edit' ? (
                <div className="space-y-4 px-6 py-4">
                  <div className="space-y-1">
                    <Label>Asunto</Label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="font-medium"
                    />
                  </div>

                  <ChipInput label="Para" values={to} onChange={setTo} />
                  <ChipInput label="CC" values={cc} onChange={setCc} />

                  <div className="space-y-1">
                    <Label>Nota ejecutiva (opcional)</Label>
                    <Textarea
                      placeholder="Agrega contexto o instrucciones adicionales. Aparecerá al inicio del correo destacada en amarillo."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  srcDoc={computedHtml}
                  sandbox="allow-same-origin"
                  className="h-full min-h-[400px] w-full border-0"
                  title="Vista previa del correo"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-stone-200 px-6 py-4">
              <Button variant="outline" onClick={onClose} disabled={sending}>
                Cancelar
              </Button>
              <Button onClick={handleSend} disabled={sending || to.length === 0}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enviar correo
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
