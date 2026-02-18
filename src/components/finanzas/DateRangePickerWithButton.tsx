'use client';

import { CalendarIcon } from 'lucide-react';

interface DateRangePickerWithButtonProps {
  startDate: string;
  endDate: string;
}

export function DateRangePickerWithButton({ startDate, endDate }: DateRangePickerWithButtonProps) {
  return (
    <form className="flex items-center space-x-2" method="get">
      <input type="hidden" name="tab" value="pagos" />
      <div className="flex items-center space-x-2 bg-muted p-2 rounded-md">
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Desde:</span>
        <input
          type="date"
          name="start_date"
          defaultValue={startDate}
          className="bg-transparent text-sm outline-none"
        />
        <span className="text-sm text-muted-foreground">Hasta:</span>
        <input
          type="date"
          name="end_date"
          defaultValue={endDate}
          className="bg-transparent text-sm outline-none"
        />
      </div>
      <button type="submit" className="bg-primary text-primary-foreground px-3 py-2 text-sm rounded-md hover:bg-primary/90">
        Filtrar
      </button>
    </form>
  );
}
