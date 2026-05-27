'use client';

import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = {
  value: number | null | undefined;
  onChange: (value: number | undefined) => void;
  onBlur?: () => void;
  allowNegative?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
};

function isPartialDecimal(raw: string, allowNegative: boolean): boolean {
  if (raw === '' || raw === '.') return true;
  if (allowNegative && (raw === '-' || raw === '-.')) return true;
  return /^-?\d*\.?\d*$/.test(raw);
}

function parseDecimal(raw: string): number | undefined {
  const t = raw.trim();
  if (t === '' || t === '.' || t === '-' || t === '-.') return undefined;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Text input that allows typing decimals (e.g. 23.5) without coercing to 0 mid-keystroke. */
export default function DecimalInput({
  value,
  onChange,
  onBlur,
  allowNegative = false,
  placeholder,
  className,
  inputClassName,
}: Props) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setDraft('');
  }, [value]);

  const display = draft !== '' ? draft : value != null && Number.isFinite(value) ? String(value) : '';

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      className={cn(className, inputClassName)}
      value={display}
      onChange={(e) => {
        const raw = e.target.value;
        if (isPartialDecimal(raw, allowNegative)) {
          setDraft(raw);
        }
      }}
      onBlur={() => {
        const committed = parseDecimal(draft !== '' ? draft : display);
        onChange(committed);
        setDraft(committed != null ? String(committed) : '');
        onBlur?.();
      }}
    />
  );
}
