'use client';

import React, { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Lock } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AVAILABLE_COLUMNS,
  DEFAULT_TEMPLATES,
  type ReportColumn,
} from '@/types/pdf-reports';

/** Fixed height so Radix ScrollArea viewport gets a defined size and scrolls. */
const LIST_HEIGHT_CLASS = 'h-[280px]';

export interface ReportColumnPickerProps {
  orderedCols: ReportColumn[];
  onSetOrder: (cols: ReportColumn[]) => void;
  onRemove: (id: string) => void;
  onAddCol: (col: ReportColumn) => void;
  onApplyPreset: (ids: string[]) => void;
}

function SortableColumnRow({
  col,
  onRemove,
}: {
  col: ReportColumn;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: col.id, disabled: false });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };

  const required = Boolean(col.required);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded border border-transparent px-2 py-1.5 text-xs text-stone-700 hover:border-stone-200 hover:bg-stone-50 ${
        isDragging ? 'z-10 border-stone-300 bg-stone-100 shadow-sm' : ''
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-0.5 text-stone-400 hover:bg-stone-200/80 hover:text-stone-700 active:cursor-grabbing"
        aria-label={`Arrastrar columna ${col.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 shrink-0" />
      </button>
      <span className="flex-1 truncate">{col.label}</span>
      {required ? (
        <span
          className="inline-flex items-center text-stone-400"
          title="Columna requerida en el reporte"
        >
          <Lock className="h-3.5 w-3.5" aria-hidden />
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onRemove(col.id)}
          className="shrink-0 text-stone-400 hover:text-red-500"
          aria-label={`Quitar columna ${col.label}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function ReportColumnPicker({
  orderedCols,
  onSetOrder,
  onRemove,
  onAddCol,
  onApplyPreset,
}: ReportColumnPickerProps) {
  const [search, setSearch] = useState('');

  const selected = useMemo(
    () => new Set(orderedCols.map((c) => c.id)),
    [orderedCols],
  );

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return AVAILABLE_COLUMNS.filter((c) => {
      if (selected.has(c.id)) return false;
      if (!q) return true;
      return (
        c.label.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    });
  }, [search, selected]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedCols.findIndex((c) => c.id === active.id);
    const newIndex = orderedCols.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onSetOrder(arrayMove(orderedCols, oldIndex, newIndex));
  };

  const sortableIds = orderedCols.map((c) => c.id);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Presets */}
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-stone-800">
          Plantillas Rápidas
        </p>
        <div className="space-y-2">
          {DEFAULT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onApplyPreset(t.selectedColumns)}
              className="w-full rounded-md border border-stone-200 px-3 py-2 text-left text-xs hover:border-stone-900 hover:bg-stone-50"
            >
              <div className="font-medium text-stone-800">{t.name}</div>
              <div className="mt-0.5 text-stone-500">{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Available + Selected */}
      <div className="space-y-3">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-stone-800">
            Columnas Disponibles
          </p>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar columna…"
            className="mb-2 h-8 border-stone-200 text-xs"
            aria-label="Filtrar columnas disponibles"
          />
          <ScrollArea className={`${LIST_HEIGHT_CLASS} pr-3`}>
            <div className="space-y-1 pb-1">
              {available.length === 0 ? (
                <p className="py-4 text-center text-xs text-stone-400">
                  {search.trim()
                    ? 'Ninguna columna coincide con la búsqueda'
                    : 'Todas las columnas ya están seleccionadas'}
                </p>
              ) : (
                available.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => onAddCol(col)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-50"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-stone-300" />
                    {col.label}
                    <span className="ml-auto text-stone-400">{col.width}</span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-stone-800">
            Columnas Seleccionadas ({orderedCols.length})
          </p>
          <p className="mb-2 text-[11px] text-stone-500">
            Arrastra el ícono de agarre para reordenar. El orden define PDF y
            Excel.
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <ScrollArea className={`${LIST_HEIGHT_CLASS} pr-3`}>
              <SortableContext
                items={sortableIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-0.5 pb-1">
                  {orderedCols.map((col) => (
                    <SortableColumnRow
                      key={col.id}
                      col={col}
                      onRemove={onRemove}
                    />
                  ))}
                </div>
              </SortableContext>
            </ScrollArea>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
