'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isWithinInterval, isBefore, isAfter, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface DateRangeFilterProps {
  dateRange: {
    from: Date;
    to: Date;
  };
  onApply: (dateRange: { from: Date; to: Date }) => void;
  onCancel: () => void;
}

export function DateRangeFilter({ dateRange, onApply, onCancel }: DateRangeFilterProps) {
  const [tempRange, setTempRange] = useState(dateRange);
  const [selectingFrom, setSelectingFrom] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(tempRange.from);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = monthStart.getDay();
  const emptyDays = Array(firstDayOfWeek).fill(null);

  const handleDateSelect = (date: Date) => {
    // Ensure we're working with start of day to avoid timezone issues
    const selectedDate = startOfDay(date);
    
    if (selectingFrom) {
      // If selecting "from" date and it's after current "to", adjust "to"
      if (isAfter(selectedDate, tempRange.to)) {
        setTempRange({ from: selectedDate, to: endOfDay(selectedDate) });
      } else {
        setTempRange({ ...tempRange, from: selectedDate });
      }
      setSelectingFrom(false);
    } else {
      // If selecting "to" date and it's before current "from", adjust "from"
      if (isBefore(selectedDate, tempRange.from)) {
        setTempRange({ from: selectedDate, to: endOfDay(selectedDate) });
      } else {
        setTempRange({ ...tempRange, to: endOfDay(selectedDate) });
      }
      setSelectingFrom(true);
    }
  };

  const handleQuickFilter = (days: number) => {
    const now = new Date();
    const newRange = {
      from: startOfDay(subDays(now, days)),
      to: endOfDay(now)
    };
    setTempRange(newRange);
    setCurrentMonth(newRange.from);
  };

  const handleApply = () => {
    onApply(tempRange);
  };

  const isDateInRange = (date: Date) => {
    try {
      return isWithinInterval(date, { start: tempRange.from, end: tempRange.to });
    } catch {
      return false;
    }
  };

  const isDateDisabled = (date: Date) => {
    return isAfter(date, new Date());
  };

  return (
    <>
      {/* Full Screen Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100]"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', duration: 0.3 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] glass-thick rounded-3xl shadow-2xl z-[101] border border-white/20 overflow-hidden flex flex-col"
      >
        <div className="p-6 overflow-y-auto flex-1 scrollbar-thin">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-title-2 font-bold text-label-primary">
                Filtrar por Período
              </h2>
              <p className="text-footnote text-label-secondary mt-1">
                Selecciona las fechas de inicio y fin
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6 text-label-secondary" />
            </button>
          </div>

          {/* Date Range Display */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setSelectingFrom(true)}
              className={`p-4 rounded-2xl border-2 transition-all ${
                selectingFrom
                  ? 'border-systemBlue bg-systemBlue/5'
                  : 'border-white/10 glass-thin'
              }`}
            >
              <p className="text-caption text-label-secondary mb-1">Desde</p>
              <p className="text-callout font-semibold text-label-primary">
                {format(tempRange.from, 'dd MMM yyyy', { locale: es })}
              </p>
            </button>
            <button
              onClick={() => setSelectingFrom(false)}
              className={`p-4 rounded-2xl border-2 transition-all ${
                !selectingFrom
                  ? 'border-systemBlue bg-systemBlue/5'
                  : 'border-white/10 glass-thin'
              }`}
            >
              <p className="text-caption text-label-secondary mb-1">Hasta</p>
              <p className="text-callout font-semibold text-label-primary">
                {format(tempRange.to, 'dd MMM yyyy', { locale: es })}
              </p>
            </button>
          </div>

          {/* Calendar */}
          <div className="glass-base rounded-2xl p-6 mb-6">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                className="p-2 rounded-xl hover:bg-white/10 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-label-primary" />
              </button>
              
              <h3 className="text-title-3 font-semibold text-label-primary capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </h3>
              
              <button
                onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                className="p-2 rounded-xl hover:bg-white/10 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-label-primary" />
              </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-2 mb-3">
              {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, i) => (
                <div
                  key={i}
                  className="text-center text-caption font-semibold text-label-tertiary py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {emptyDays.map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {days.map((day) => {
                const isSelected = isSameDay(day, tempRange.from) || isSameDay(day, tempRange.to);
                const isInRange = isDateInRange(day);
                const isToday = isSameDay(day, new Date());
                const isDisabled = isDateDisabled(day);
                const isStart = isSameDay(day, tempRange.from);
                const isEnd = isSameDay(day, tempRange.to);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => !isDisabled && handleDateSelect(day)}
                    disabled={isDisabled}
                    className={`
                      relative aspect-square rounded-xl transition-all flex items-center justify-center
                      ${isSelected 
                        ? 'bg-[#007AFF] shadow-lg' 
                        : isInRange
                        ? 'glass-thin border border-systemBlue/20'
                        : isToday
                        ? 'glass-thin border border-systemBlue/30'
                        : 'glass-base border border-white/10 hover:glass-thin hover:border-white/20'
                      }
                      ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
                    `}
                  >
                    <span className={`relative z-10 text-footnote font-semibold ${
                      isSelected 
                        ? 'text-white' 
                        : isInRange || isToday
                        ? 'text-systemBlue'
                        : 'text-label-primary'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    {isToday && !isSelected && (
                      <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-systemBlue rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Filters */}
          <div className="mb-6">
            <p className="text-caption font-medium text-label-secondary mb-3">
              Accesos Rápidos
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Últimos 7 días', days: 7 },
                { label: 'Últimos 30 días', days: 30 },
                { label: 'Últimos 60 días', days: 60 },
                { label: 'Últimos 90 días', days: 90 }
              ].map(({ label, days }) => (
                <button
                  key={days}
                  onClick={() => handleQuickFilter(days)}
                  className="px-4 py-2.5 rounded-xl glass-thin hover:glass-interactive text-footnote font-medium text-label-primary transition-all"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3 glass-thin hover:glass-interactive text-label-primary rounded-xl text-callout font-medium transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleApply}
              className="flex-1 px-6 py-3 bg-[#007AFF] hover:bg-[#0051D5] text-white rounded-xl text-callout font-semibold transition-all shadow-lg"
            >
              Aplicar Filtros
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

export default DateRangeFilter;

