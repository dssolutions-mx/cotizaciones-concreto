'use client';

import React from 'react';
import { Calendar } from "@/components/ui/calendar";
import { es } from 'date-fns/locale';

// Create a custom Spanish calendar component
const SpanishCalendar = (props: any) => {
  // Override the day names to use cleaner Spanish abbreviations
  const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  return (
    <div className="spanish-calendar">
      <style jsx>{`
        .spanish-calendar :global(.rdp-head_cell) {
          font-size: 0.8rem !important;
          font-weight: 500 !important;
          padding: 0.5rem 0 !important;
          text-align: center !important;
        }

        .spanish-calendar :global(.rdp-months) {
          display: flex;
          justify-content: space-between;
        }

        .spanish-calendar :global(.rdp-caption) {
          padding: 0 0.5rem;
          font-weight: 500;
          font-size: 0.9rem;
          text-align: center;
        }
      `}</style>
      <Calendar
        {...props}
        locale={es}
        ISOWeek
        formatters={{
          formatWeekdayName: () => "",  // Clear default day names
        }}
        components={{
          HeadCell: ({ value }: { value: Date }) => {
            // Display our custom day names
            const index = value.getDay();
            // Sunday is 0 in JS but the last day in our array
            const adjustedIndex = index === 0 ? 6 : index - 1;
            return <th className="rdp-head_cell">{dayNames[adjustedIndex]}</th>;
          }
        }}
      />
    </div>
  )
}

export default SpanishCalendar;
