import React from 'react';
import { Button } from './button';
import { DatePicker } from './date-picker';
import { addDays, startOfWeek, endOfWeek, isSameDay } from 'date-fns';

interface DateFilterProps {
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  className?: string;
}

export const DateFilter: React.FC<DateFilterProps> = ({ selectedDate, onDateChange, className }) => {
  // Quick filter handlers
  const today = new Date();
  const yesterday = addDays(today, -1);
  const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(today, { weekStartsOn: 1 });

  return (
    <div className={`flex flex-col gap-2 ${className || ''}`}>
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedDate && isSameDay(selectedDate, today) ? 'default' : 'outline'}
          size="sm"
          onClick={() => onDateChange(today)}
        >
          Hoy
        </Button>
        <Button
          variant={selectedDate && isSameDay(selectedDate, yesterday) ? 'default' : 'outline'}
          size="sm"
          onClick={() => onDateChange(yesterday)}
        >
          Ayer
        </Button>
        <Button
          variant={selectedDate && isSameDay(selectedDate, thisWeekStart) ? 'default' : 'outline'}
          size="sm"
          onClick={() => onDateChange(thisWeekStart)}
        >
          Esta semana (inicio)
        </Button>
        <Button
          variant={selectedDate && isSameDay(selectedDate, thisWeekEnd) ? 'default' : 'outline'}
          size="sm"
          onClick={() => onDateChange(thisWeekEnd)}
        >
          Esta semana (fin)
        </Button>
        <DatePicker date={selectedDate} setDate={onDateChange} className="w-auto min-w-[160px]" />
      </div>
    </div>
  );
}; 