'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  selected?: Date;
  onSelect: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  selected,
  onSelect,
  placeholder = 'Seleccionar fecha',
  className,
  disabled = false
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'glass-thin px-3 py-2 rounded-xl text-body text-gray-900 w-full',
          'border border-white/40 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
          'flex items-center justify-between',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        disabled={disabled}
      >
        <span className={cn('flex-1 text-left', !selected && 'text-gray-400')}>
          {selected ? format(selected, 'dd MMM yyyy', { locale: es }) : placeholder}
        </span>
        <CalendarIcon className="w-5 h-5 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 glass-thick rounded-2xl p-4 shadow-lg z-50 min-w-[280px]">
          <div className="text-center mb-4">
            <h3 className="text-title-3 font-bold text-gray-900">
              Seleccionar Fecha
            </h3>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-4">
            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day) => (
              <div key={day} className="text-caption text-gray-500 text-center py-2">
                {day}
              </div>
            ))}

            {/* Sample dates - in a real implementation, this would be generated dynamically */}
            {Array.from({ length: 31 }, (_, i) => i + 1).map((date) => (
              <button
                key={date}
                onClick={() => {
                  onSelect(new Date(2024, 9, date));
                  setIsOpen(false);
                }}
                className={cn(
                  'text-body rounded-lg p-2 hover:glass-thin transition-all',
                  selected?.getDate() === date && 'bg-blue-500 text-white'
                )}
              >
                {date}
              </button>
            ))}
          </div>

          <div className="flex justify-between gap-2">
            <button
              onClick={() => setIsOpen(false)}
              className="flex-1 glass-thin rounded-xl py-2 text-body text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
            <button
              onClick={() => onSelect(new Date())}
              className="flex-1 bg-blue-500 text-white rounded-xl py-2 text-body font-medium hover:bg-blue-600"
            >
              Hoy
            </button>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

