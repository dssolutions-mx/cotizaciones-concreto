'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Users } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const MAX_VISIBLE = 8;

function matchReasonVariant(reason: string): 'warning' | 'secondary' | 'outline' {
  if (reason.includes('exacto') || reason.includes('contiene')) return 'warning';
  if (reason.includes('Código')) return 'warning';
  return 'secondary';
}

interface LiveDuplicateSuggestionsProps {
  isChecking: boolean;
  duplicates: Array<{ id: string; business_name: string; client_code: string | null; match_reason: string }>;
  className?: string;
}

export function LiveDuplicateSuggestions({ isChecking, duplicates, className }: LiveDuplicateSuggestionsProps) {
  if (isChecking) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-600',
          className
        )}
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
        <span>Buscando clientes similares…</span>
      </div>
    );
  }

  if (duplicates.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-green-200 bg-green-50/80 px-3 py-2.5 text-sm text-green-700',
          className
        )}
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
        <span>No se encontraron clientes similares</span>
      </div>
    );
  }

  const visible = duplicates.slice(0, MAX_VISIBLE);
  const remaining = duplicates.length - MAX_VISIBLE;

  return (
    <div
      className={cn(
        'rounded-lg border border-amber-200/80 bg-amber-50/60 shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-amber-200/60 px-3 py-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-100">
          <Users className="h-3.5 w-3.5 text-amber-700" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900">Clientes similares encontrados</p>
          <p className="text-xs text-amber-700/90">Revise si ya existe antes de crear</p>
        </div>
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
      </div>
      <ScrollArea className="h-[180px]">
        <ul className="divide-y divide-amber-100/80 p-2">
          {visible.map((d) => (
            <li
              key={d.id}
              className="flex flex-col gap-1 py-2 px-2.5 rounded-md hover:bg-amber-50/80 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-slate-800 truncate">{d.business_name}</span>
                <Badge variant={matchReasonVariant(d.match_reason)} className="shrink-0 text-[10px] px-1.5 py-0">
                  {d.match_reason}
                </Badge>
              </div>
              {d.client_code && (
                <span className="text-xs text-slate-500 font-mono">{d.client_code}</span>
              )}
            </li>
          ))}
        </ul>
      </ScrollArea>
      {remaining > 0 && (
        <div className="border-t border-amber-200/60 px-3 py-2 text-center">
          <span className="text-xs text-amber-700">y {remaining} coincidencia{remaining !== 1 ? 's' : ''} más</span>
        </div>
      )}
    </div>
  );
}
