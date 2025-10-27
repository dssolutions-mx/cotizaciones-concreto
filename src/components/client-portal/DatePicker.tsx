'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isBefore, startOfDay, format } from 'date-fns';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  minDate?: string; // YYYY-MM-DD
  label?: string;
}

// Helper to parse date string as local date (not UTC)
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Helper to format date as YYYY-MM-DD in local timezone
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function DatePicker({ value, onChange, minDate, label }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value ? parseLocalDate(value) : new Date());

  const selectedDate = useMemo(() => value ? parseLocalDate(value) : null, [value]);
  const minDateObj = useMemo(() => minDate ? parseLocalDate(minDate) : null, [minDate]);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  
  const daysInView = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handleDateSelect = (date: Date) => {
    const formatted = formatLocalDate(date);
    onChange(formatted);
    setIsOpen(false);
  };

  const isDisabled = (date: Date) => {
    if (minDateObj && isBefore(startOfDay(date), startOfDay(minDateObj))) {
      return true;
    }
    return false;
  };

  return (
    <div className="relative">
      <label className="block text-footnote text-label-tertiary mb-2">{label || 'Fecha'}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left rounded-xl glass-thin px-4 py-3 border border-white/20 focus:border-primary/50 focus:outline-none flex items-center justify-between"
      >
        <span className="text-label-primary">
          {value ? (() => {
            const date = parseLocalDate(value);
            const dayName = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][date.getDay()];
            const monthName = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][date.getMonth()];
            return `${dayName}, ${date.getDate()} de ${monthName} ${date.getFullYear()}`;
          })() : 'Seleccionar fecha'}
        </span>
        <Calendar className="w-5 h-5 text-label-tertiary" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1.0] }}
              className="absolute z-50 mt-2 w-full max-w-sm glass-base rounded-3xl p-6 border border-white/30 shadow-2xl"
            >
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-6">
                <button
                  type="button"
                  onClick={() => setViewDate(subMonths(viewDate, 1))}
                  className="p-2 rounded-xl glass-thin hover:glass-interactive transition-all"
                >
                  <ChevronLeft className="w-5 h-5 text-label-primary" />
                </button>
                <h3 className="text-title-3 font-bold text-label-primary">
                  {(() => {
                    const monthName = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][viewDate.getMonth()];
                    return `${monthName} ${viewDate.getFullYear()}`;
                  })()}
                </h3>
                <button
                  type="button"
                  onClick={() => setViewDate(addMonths(viewDate, 1))}
                  className="p-2 rounded-xl glass-thin hover:glass-interactive transition-all"
                >
                  <ChevronRight className="w-5 h-5 text-label-primary" />
                </button>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-2 mb-3">
                {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, i) => (
                  <div key={i} className="text-center text-caption text-label-tertiary font-semibold">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {daysInView.map((day, i) => {
                  const isCurrentMonth = isSameMonth(day, viewDate);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  const disabled = isDisabled(day);

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => !disabled && handleDateSelect(day)}
                      disabled={disabled}
                      className={`
                        aspect-square rounded-xl text-callout font-medium transition-all
                        ${!isCurrentMonth ? 'text-label-tertiary opacity-30' : ''}
                        ${isSelected 
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30' 
                          : isToday 
                            ? 'glass-thin border-2 border-primary/50 text-label-primary'
                            : disabled
                              ? 'text-label-tertiary opacity-30 cursor-not-allowed'
                              : 'glass-thin hover:glass-interactive text-label-primary'
                        }
                      `}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>

              {/* Today shortcut */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    if (!isDisabled(today)) {
                      handleDateSelect(today);
                    }
                  }}
                  disabled={minDateObj && isBefore(startOfDay(new Date()), startOfDay(minDateObj))}
                  className="w-full py-2 rounded-xl glass-thin hover:glass-interactive text-callout font-medium text-label-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Hoy
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

