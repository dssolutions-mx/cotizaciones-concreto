'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  formatDecimalDisplay,
  isPartialDecimalInput,
  parseDecimalInput,
} from '@/lib/quality/decimalFieldInput';

type Props = {
  value: number | null | undefined;
  onChange: (value: number | undefined) => void;
  allowNegative?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  decimals?: number;
  onBlur?: () => void;
};

export default function DecimalFieldInput({
  value,
  onChange,
  allowNegative = false,
  placeholder,
  className,
  inputClassName,
  decimals,
  onBlur,
}: Props) {
  const [raw, setRaw] = useState('');
  const display = raw !== '' ? raw : formatDecimalDisplay(value, decimals);

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      className={inputClassName ?? className}
      value={display}
      onChange={(e) => {
        const v = e.target.value;
        if (isPartialDecimalInput(v, allowNegative)) setRaw(v);
      }}
      onBlur={() => {
        const finalValue = parseDecimalInput(raw !== '' ? raw : display);
        onChange(finalValue);
        setRaw(finalValue != null ? formatDecimalDisplay(finalValue, decimals) : '');
        onBlur?.();
      }}
    />
  );
}
