'use client';

import { Calendar } from 'lucide-react';

interface DatePickerWithButtonProps {
  currentDate: string;
}

export function DatePickerWithButton({ currentDate }: DatePickerWithButtonProps) {
  return (
    <form className="flex items-center space-x-2">
      <div className="flex items-center space-x-2 bg-muted p-2 rounded-md">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <input 
          type="date" 
          name="date" 
          defaultValue={currentDate}
          className="bg-transparent text-sm outline-none"
        />
      </div>
      <button 
        type="submit"
        className="bg-primary text-primary-foreground px-3 py-2 text-sm rounded-md hover:bg-primary/90"
      >
        Filtrar
      </button>
    </form>
  );
}
