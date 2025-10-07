'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
  minDate?: Date;
  maxDate?: Date;
}

export function DatePicker({ value, onChange, label, minDate, maxDate }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get day of week for first day to align calendar
  const firstDayOfWeek = monthStart.getDay();
  const emptyDays = Array(firstDayOfWeek).fill(null);

  const handleDateSelect = (date: Date) => {
    onChange(date);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const isDateDisabled = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  return (
    <div className="relative">
      {/* Label */}
      {label && (
        <label className="block text-callout font-medium text-label-primary mb-2">
          {label}
        </label>
      )}

      {/* Input Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl glass-thin border border-white/10 hover:border-white/20 text-body text-label-primary transition-all focus:outline-none focus:ring-2 focus:ring-systemBlue/50"
      >
        <span>{format(value, 'dd MMMM yyyy', { locale: es })}</span>
        <Calendar className="w-5 h-5 text-label-secondary" />
      </button>

      {/* Picker Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />

            {/* Picker Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="absolute top-full left-0 mt-2 w-full max-w-sm glass-thick rounded-3xl p-6 shadow-xl z-50 border border-white/10"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-label-primary" />
                </button>
                
                <h3 className="text-title-3 font-semibold text-label-primary">
                  {format(currentMonth, 'MMMM yyyy', { locale: es })}
                </h3>
                
                <button
                  onClick={handleNextMonth}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-label-primary" />
                </button>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, i) => (
                  <div
                    key={i}
                    className="text-center text-caption font-medium text-label-tertiary py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {/* Empty cells for alignment */}
                {emptyDays.map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {/* Day cells */}
                {days.map((day) => {
                  const isSelected = isSameDay(day, value);
                  const isToday = isSameDay(day, new Date());
                  const isDisabled = isDateDisabled(day);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => !isDisabled && handleDateSelect(day)}
                      disabled={isDisabled}
                      className={`
                        relative aspect-square rounded-xl text-footnote font-medium transition-all
                        ${isSelected 
                          ? 'bg-systemBlue text-white shadow-md' 
                          : isToday
                          ? 'bg-systemBlue/10 text-systemBlue'
                          : 'hover:bg-white/10 text-label-primary'
                        }
                        ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      {format(day, 'd')}
                      {isToday && !isSelected && (
                        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-systemBlue rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 mt-6 pt-6 border-t border-white/10">
                <button
                  onClick={() => handleDateSelect(new Date())}
                  className="flex-1 px-4 py-2 rounded-xl glass-thin hover:glass-interactive text-callout text-label-primary transition-all"
                >
                  Hoy
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-systemBlue text-white hover:bg-systemBlue/90 text-callout font-medium transition-all"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DatePicker;

