'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ELEMENTO_QUICK_EXAMPLES,
  ELEMENTO_REFERENCE_OPTIONS,
  EMPTY_GUIDED_ELEMENTO_PARTS,
  effectiveReferenceValue,
  formatElementoGuided,
  guidedFrenteIsComplete,
  parseKmPlusPattern,
  usesStructuredChainage,
  type ElementoReferenceKind,
  type FrenteChoiceId,
  type GuidedElementoParts,
} from '@/lib/client-portal/formatElemento';

const FRENTE_UNSET = '_unset';

export type ElementoFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Prefix for input ids (e.g. schedule-elemento) */
  idPrefix?: string;
  /** Guided mode: false until frente is chosen (and Otro text filled when aplica). Texto libre always reports true. */
  onGuidedValidityChange?: (complete: boolean) => void;
};

type Mode = 'free' | 'guided';

function ElementoFieldInner({
  value,
  onChange,
  idPrefix = 'portal-elemento',
  onGuidedValidityChange,
}: ElementoFieldProps) {
  const [mode, setMode] = useState<Mode>('guided');
  const [guidedParts, setGuidedParts] = useState<GuidedElementoParts>(EMPTY_GUIDED_ELEMENTO_PARTS);
  const previewRef = useRef<HTMLDivElement>(null);

  const composedPreview = useMemo(() => formatElementoGuided(guidedParts), [guidedParts]);

  /** Avoid pushing every keystroke to the parent (large schedule page re-renders). */
  const debouncedPush = useDebouncedCallback(
    (next: string) => {
      onChange(next);
    },
    120,
    { maxWait: 280, flushOnExit: true }
  );

  useEffect(() => {
    if (mode !== 'guided') return;
    debouncedPush(composedPreview);
  }, [mode, composedPreview, debouncedPush]);

  useEffect(() => {
    if (!onGuidedValidityChange) return;
    if (mode !== 'guided') {
      onGuidedValidityChange(true);
      return;
    }
    onGuidedValidityChange(guidedFrenteIsComplete(guidedParts));
  }, [mode, guidedParts, onGuidedValidityChange]);

  const flushToParent = useCallback(() => {
    debouncedPush.flush();
  }, [debouncedPush]);

  const updateGuided = useCallback((patch: Partial<GuidedElementoParts>) => {
    setGuidedParts((prev) => ({ ...prev, ...patch }));
  }, []);

  const changeReferenceKind = useCallback((v: ElementoReferenceKind) => {
    setGuidedParts((prev) => {
      const nextKind = v;
      if (usesStructuredChainage(prev.referenceKind) && !usesStructuredChainage(nextKind)) {
        const eff = effectiveReferenceValue(prev);
        return {
          ...prev,
          referenceKind: nextKind,
          referenceValue: eff,
          chainageKm: '',
          chainageMeters: '',
        };
      }
      if (!usesStructuredChainage(prev.referenceKind) && usesStructuredChainage(nextKind)) {
        const parsed = parseKmPlusPattern(prev.referenceValue);
        if (parsed) {
          return {
            ...prev,
            referenceKind: nextKind,
            chainageKm: parsed.km,
            chainageMeters: parsed.meters,
            referenceValue: '',
          };
        }
      }
      return { ...prev, referenceKind: nextKind };
    });
  }, []);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    if (next === 'free' && mode === 'guided') {
      debouncedPush.flush();
    }
    if (next === 'guided') {
      const seed: GuidedElementoParts = {
        ...EMPTY_GUIDED_ELEMENTO_PARTS,
        description: value.trim(),
      };
      setGuidedParts(seed);
      onChange(formatElementoGuided(seed));
    }
    setMode(next);
  };

  const applyExample = (parts: GuidedElementoParts) => {
    setMode('guided');
    setGuidedParts(parts);
    onChange(formatElementoGuided(parts));
    requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const digitsOnly = (raw: string) => raw.replace(/\D/g, '');

  const freeTextareaId = `${idPrefix}-free`;
  const previewId = `${idPrefix}-preview`;
  const structured = usesStructuredChainage(guidedParts.referenceKind);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="block text-footnote text-label-tertiary uppercase tracking-wide">
          Elemento *
        </label>
        <div
          role="tablist"
          aria-label="Modo de captura de elemento"
          className="flex rounded-xl border border-white/20 p-1 glass-thin shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'guided'}
            className={cn(
              'px-4 py-2 rounded-lg text-callout font-medium transition-colors min-h-[36px]',
              mode === 'guided'
                ? 'bg-white/15 text-label-primary shadow-sm'
                : 'text-label-secondary hover:text-label-primary'
            )}
            onClick={() => switchMode('guided')}
          >
            Formato guiado
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'free'}
            className={cn(
              'px-4 py-2 rounded-lg text-callout font-medium transition-colors min-h-[36px]',
              mode === 'free'
                ? 'bg-white/15 text-label-primary shadow-sm'
                : 'text-label-secondary hover:text-label-primary'
            )}
            onClick={() => switchMode('free')}
          >
            Texto libre
          </button>
        </div>
      </div>

      <p className="text-caption text-label-secondary">
        Indica dónde se colocará el concreto (obra, tramo, elemento). El formato guiado ayuda a que la planta identifique el punto de colocación con más claridad.
      </p>

      {mode === 'free' ? (
        <textarea
          id={freeTextareaId}
          rows={3}
          placeholder="Ej: Losa de cimentación, Muro, Columna — o el texto que use tu obra."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none resize-y min-h-[88px] text-body text-label-primary"
        />
      ) : (
        <div className="space-y-4 rounded-2xl border border-white/20 bg-white/[0.03] p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label
                htmlFor={`${idPrefix}-frente`}
                className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2"
              >
                Frente *
              </label>
              <Select
                value={guidedParts.frenteChoice === '' ? FRENTE_UNSET : guidedParts.frenteChoice}
                onValueChange={(v) => {
                  if (v === FRENTE_UNSET) {
                    updateGuided({ frenteChoice: '', frenteOtroText: '' });
                    return;
                  }
                  updateGuided({
                    frenteChoice: v as FrenteChoiceId,
                    ...(v !== 'otro' ? { frenteOtroText: '' } : {}),
                  });
                }}
              >
                <SelectTrigger
                  id={`${idPrefix}-frente`}
                  className="w-full glass-thin border-white/20"
                  onBlur={flushToParent}
                  aria-invalid={guidedParts.frenteChoice === ''}
                >
                  <SelectValue placeholder="Selecciona frente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FRENTE_UNSET} className="text-label-tertiary">
                    Selecciona frente *
                  </SelectItem>
                  <SelectItem value="1">Frente 1</SelectItem>
                  <SelectItem value="2">Frente 2</SelectItem>
                  <SelectItem value="3">Frente 3</SelectItem>
                  <SelectItem value="4">Frente 4</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
              {guidedParts.frenteChoice === 'otro' && (
                <>
                  <label
                    htmlFor={`${idPrefix}-frente-otro`}
                    className="block text-footnote text-label-tertiary uppercase tracking-wide mt-3 mb-2"
                  >
                    Describe el frente *
                  </label>
                  <input
                    id={`${idPrefix}-frente-otro`}
                    type="text"
                    placeholder="Ej: Frente sur, acceso lateral…"
                    value={guidedParts.frenteOtroText}
                    onChange={(e) => updateGuided({ frenteOtroText: e.target.value })}
                    onBlur={flushToParent}
                    className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                  />
                </>
              )}
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor={`${idPrefix}-ref-kind`}
                className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2"
              >
                Referencia / ubicación
              </label>
              <Select value={guidedParts.referenceKind} onValueChange={(v) => changeReferenceKind(v as ElementoReferenceKind)}>
                <SelectTrigger
                  id={`${idPrefix}-ref-kind`}
                  className="w-full glass-thin border-white/20"
                  onBlur={flushToParent}
                >
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {ELEMENTO_REFERENCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {guidedParts.referenceKind === 'otro' && (
              <div className="md:col-span-2">
                <label
                  htmlFor={`${idPrefix}-ref-custom`}
                  className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2"
                >
                  Etiqueta personalizada
                </label>
                <input
                  id={`${idPrefix}-ref-custom`}
                  type="text"
                  placeholder="Ej: Sección, Eje, Bloque"
                  value={guidedParts.customReferenceLabel}
                  onChange={(e) => updateGuided({ customReferenceLabel: e.target.value })}
                  onBlur={flushToParent}
                  className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                />
              </div>
            )}

            {structured ? (
              <div className="md:col-span-2">
                <p className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2">
                  {guidedParts.referenceKind === 'cadenamiento'
                    ? 'Cadenamiento (km + m)'
                    : 'PK / Kilometraje (km + m)'}
                </p>
                <p className="text-caption text-label-secondary mb-3">
                  {guidedParts.referenceKind === 'cadenamiento'
                    ? 'Solo números: generamos el texto tipo KM 12+380 automáticamente.'
                    : 'Solo números: generamos el formato 12+380 (sin prefijo KM) para PK.'}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {guidedParts.referenceKind === 'cadenamiento' ? (
                    <span className="text-callout font-semibold text-label-secondary shrink-0">KM</span>
                  ) : null}
                  <input
                    id={`${idPrefix}-chain-km`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="12"
                    aria-label="Kilómetro entero"
                    value={guidedParts.chainageKm}
                    onChange={(e) => updateGuided({ chainageKm: digitsOnly(e.target.value) })}
                    onBlur={flushToParent}
                    className="w-[88px] min-w-0 rounded-xl glass-thin px-3 py-3 border border-white/20 focus:border-primary/50 focus:outline-none text-center tabular-nums"
                  />
                  <span className="text-title-3 font-light text-label-tertiary px-1" aria-hidden>
                    +
                  </span>
                  <input
                    id={`${idPrefix}-chain-m`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="380"
                    aria-label="Metros en cadena"
                    value={guidedParts.chainageMeters}
                    onChange={(e) => updateGuided({ chainageMeters: digitsOnly(e.target.value) })}
                    onBlur={flushToParent}
                    className="w-[96px] min-w-0 rounded-xl glass-thin px-3 py-3 border border-white/20 focus:border-primary/50 focus:outline-none text-center tabular-nums"
                  />
                </div>
              </div>
            ) : (
              <div className="md:col-span-2">
                <label
                  htmlFor={`${idPrefix}-ref-val`}
                  className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2"
                >
                  Valor de referencia
                </label>
                <input
                  id={`${idPrefix}-ref-val`}
                  type="text"
                  placeholder="Ej: Eje A–B, E-03"
                  value={guidedParts.referenceValue}
                  onChange={(e) => updateGuided({ referenceValue: e.target.value })}
                  onBlur={flushToParent}
                  className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
                />
              </div>
            )}

            <div className="md:col-span-2">
              <label
                htmlFor={`${idPrefix}-struct`}
                className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2"
              >
                Elemento a colar
              </label>
              <input
                id={`${idPrefix}-struct`}
                type="text"
                placeholder="Ej: Muro 2, Losa nivel 1"
                value={guidedParts.elementoStructural}
                onChange={(e) => updateGuided({ elementoStructural: e.target.value })}
                onBlur={flushToParent}
                className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor={`${idPrefix}-desc`}
                className="block text-footnote text-label-tertiary uppercase tracking-wide mb-2"
              >
                Descripción
              </label>
              <textarea
                id={`${idPrefix}-desc`}
                rows={3}
                placeholder="Detalle adicional: ejes, accesos, referencias en obra…"
                value={guidedParts.description}
                onChange={(e) => updateGuided({ description: e.target.value })}
                onBlur={flushToParent}
                className="w-full rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none resize-y min-h-[80px]"
              />
            </div>
          </div>

          <div>
            <p className="text-footnote text-label-tertiary uppercase tracking-wide mb-2">
              Ejemplos rápidos
            </p>
            <div className="flex flex-wrap gap-2">
              {ELEMENTO_QUICK_EXAMPLES.map((ex) => (
                <Button
                  key={ex.id}
                  type="button"
                  variant="glassSecondary"
                  size="sm"
                  className="rounded-full text-caption"
                  onClick={() => applyExample({ ...ex.parts })}
                >
                  {ex.chipLabel}
                </Button>
              ))}
            </div>
          </div>

          <div
            ref={previewRef}
            id={previewId}
            className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3"
            aria-live="polite"
          >
            <p className="text-footnote text-label-tertiary uppercase tracking-wide mb-1">
              Así se enviará
            </p>
            <p className="text-callout text-label-primary whitespace-pre-wrap break-words">
              {composedPreview.trim() ? (
                composedPreview
              ) : (
                <span className="text-label-tertiary font-normal">
                  Completa al menos un campo para generar el texto.
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const ElementoField = memo(ElementoFieldInner);
export default ElementoField;
