'use client'

import * as React from "react"
import { DateRange } from "react-day-picker"
import DateRangePicker from 'rsuite/DateRangePicker'
import 'rsuite/DateRangePicker/styles/index.css'
import { startOfMonth, endOfMonth, subMonths } from "date-fns"
import { cn } from "@/lib/utils"

export interface DateRangePickerProps {
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
  className?: string
}

export function DateRangePickerWithPresets({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  // Convert dateRange to RSuite's format if it exists
  const [value, setValue] = React.useState<[Date, Date] | null>(
    dateRange?.from && dateRange?.to 
      ? [dateRange.from, dateRange.to] 
      : null
  );

  // Handle RSuite DateRangePicker change
  const handleChange = (value: [Date, Date] | null) => {
    setValue(value);
    
    if (value && value.length === 2) {
      onDateRangeChange({
        from: value[0],
        to: value[1]
      });
    } else {
      onDateRangeChange(undefined);
    }
  };

  // Ensure the value is updated if dateRange changes externally
  React.useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      setValue([dateRange.from, dateRange.to]);
    } else {
      setValue(null);
    }
  }, [dateRange]);

  // Current date for predefined ranges
  const today = new Date();
  
  // Add logic to adjust popup position when it opens
  const [pickerRef, setPickerRef] = React.useState<HTMLDivElement | null>(null);
  
  React.useEffect(() => {
    // Function to adjust calendar popup position
    const adjustCalendarPosition = () => {
      setTimeout(() => {
        const popup = document.querySelector('.rs-picker-popup');
        if (popup && pickerRef) {
          const rect = pickerRef.getBoundingClientRect();
          const windowWidth = window.innerWidth;
          const windowHeight = window.innerHeight;
          
          // Get popup dimensions
          const popupWidth = popup.getBoundingClientRect().width;
          const popupHeight = popup.getBoundingClientRect().height;
          
          // Default alignment - align with the left edge of the input
          let leftPosition = rect.left;
          let topPosition = rect.bottom + 5; // 5px padding below the input
          
          // Check if too close to right edge
          if (leftPosition + popupWidth > windowWidth - 10) {
            // Align with the right edge of the input if possible
            leftPosition = Math.max(10, rect.right - popupWidth);
          }
          
          // Check if it would go below the bottom of the viewport
          if (topPosition + popupHeight > windowHeight - 10) {
            // Position above the input instead
            topPosition = Math.max(10, rect.top - popupHeight - 5);
          }
          
          // Apply the positions
          (popup as HTMLElement).style.left = `${leftPosition}px`;
          (popup as HTMLElement).style.top = `${topPosition}px`;
          
          // Ensure popup is not too wide for the screen
          if (popupWidth > windowWidth - 20) {
            (popup as HTMLElement).style.width = `${windowWidth - 20}px`;
          }
        }
      }, 10);
    };
    
    // Observe picker element for events that might open the popup
    if (pickerRef) {
      pickerRef.addEventListener('click', adjustCalendarPosition);
      
      // Also handle window resize to readjust if needed
      window.addEventListener('resize', adjustCalendarPosition);
      
      // Clean up
      return () => {
        pickerRef.removeEventListener('click', adjustCalendarPosition);
        window.removeEventListener('resize', adjustCalendarPosition);
      };
    }
  }, [pickerRef]);
  
  return (
    <div 
      className={cn("grid gap-2 relative", className)}
      ref={setPickerRef}
    >
      <div className="date-range-picker-container">
        <DateRangePicker
          value={value}
          onChange={handleChange}
          ranges={[
            {
              label: 'Este Mes',
              value: [startOfMonth(today), endOfMonth(today)] as [Date, Date]
            },
            {
              label: 'Mes Anterior',
              value: [
                startOfMonth(subMonths(today, 1)), 
                endOfMonth(subMonths(today, 1))
              ] as [Date, Date]
            },
            {
              label: 'Últimos 3 Meses',
              value: [subMonths(today, 3), today] as [Date, Date]
            },
            {
              label: 'Últimos 6 Meses',
              value: [subMonths(today, 6), today] as [Date, Date]
            }
          ]}
          placeholder="Seleccionar fechas"
          format="dd/MM/yyyy"
          locale={{
            sunday: 'D',
            monday: 'L',
            tuesday: 'M',
            wednesday: 'X',
            thursday: 'J',
            friday: 'V',
            saturday: 'S',
            ok: 'Aplicar',
            today: 'Hoy',
            yesterday: 'Ayer',
            last7Days: 'Últimos 7 días'
          }}
          showOneCalendar={false}
          cleanable
          block
          placement="autoVerticalStart"
        />
      </div>
      <style jsx global>{`
        /* Comprehensive green styling for DateRangePicker */
        .rs-calendar-table-cell-content {
          transition: all 0.2s ease;
        }
        
        /* Selected and primary elements */
        .rs-calendar-table-cell-selected .rs-calendar-table-cell-content,
        .rs-btn-primary {
          background-color: #10b981 !important;
          color: white !important;
        }
        
        /* In-range styling */
        .rs-calendar-table-cell-in-range .rs-calendar-table-cell-content,
        .rs-calendar-table-cell-highlight .rs-calendar-table-cell-content {
          background-color: rgba(16, 185, 129, 0.2) !important;
          color: #10b981 !important;
        }
        
        /* Hover states */
        .rs-calendar-table-cell:hover .rs-calendar-table-cell-content,
        .rs-calendar-table-cell-in-range:hover .rs-calendar-table-cell-content,
        .rs-calendar-table-cell-highlight:hover .rs-calendar-table-cell-content {
          background-color: rgba(16, 185, 129, 0.4) !important;
          color: #10b981 !important;
        }
        
        /* Ensure no blue remnants */
        .rs-calendar-table-cell-content {
          border-color: transparent !important;
        }
        
        /* Fix calendar positioning and size */
        .rs-picker-popup {
          z-index: 1000 !important;
          position: fixed !important;
          max-width: 95vw !important;
          overflow: auto !important;
          transform: none !important;
        }
        
        /* Override default transition to prevent positioning issues */
        .rs-anim-in {
          animation: none !important;
          opacity: 1 !important;
        }

        /* Responsive calendar */
        @media (max-width: 640px) {
          .rs-picker-popup {
            width: 95vw !important;
          }
          
          .rs-calendar {
            width: 100% !important;
          }
          
          .rs-picker-toolbar {
            flex-wrap: wrap !important;
          }
        }
        
        /* Make date grid more compact on small screens */
        @media (max-width: 768px) {
          .rs-calendar-table-cell {
            padding: 0 !important;
          }
          
          .rs-calendar-table-cell-content {
            min-width: 28px !important;
            height: 28px !important;
            line-height: 28px !important;
          }
        }
      `}</style>
    </div>
  )
} 