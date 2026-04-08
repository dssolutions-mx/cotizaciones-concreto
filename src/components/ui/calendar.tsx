"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

/** Neutral day cell: avoid `buttonVariants(ghost)` — project ghost uses systemBlue. */
const dayButtonNeutral = cn(
  "inline-flex h-9 w-9 items-center justify-center rounded-md p-0 text-sm font-normal",
  "text-stone-700 hover:bg-stone-100 hover:text-stone-900",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/50 focus-visible:ring-offset-1",
  "aria-selected:opacity-100"
)

const navButtonNeutral = cn(
  "inline-flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white p-0",
  "text-stone-600 shadow-sm opacity-90 hover:bg-stone-50 hover:text-stone-900 hover:opacity-100",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/40"
)

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const customStyles = `
    .rdp-weekdays {
      display: none !important;
    }
  `

  return (
    <>
      <style>{customStyles}</style>

      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn(
          "rounded-lg border border-stone-200 bg-white p-3 text-stone-900 shadow-sm",
          className
        )}
        locale={es}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4",
          caption: "flex justify-center pt-1 relative items-center",
          caption_label: "text-sm font-semibold text-stone-800",
          nav: "space-x-1 flex items-center",
          nav_button: navButtonNeutral,
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
          // react-day-picker v9 uses these keys for nav buttons
          button_previous: cn(navButtonNeutral, "absolute left-1 top-0"),
          button_next: cn(navButtonNeutral, "absolute right-1 top-0"),
          table: "w-full border-collapse space-y-1",
          weekdays: "grid grid-cols-7 mt-2",
          weekday: "text-muted-foreground text-xs font-medium text-center",
          week: "grid grid-cols-7 mt-2",
          day: cn(
            "relative flex h-9 w-9 items-center justify-center p-0 text-center text-sm",
            "[&:has([aria-selected])]:bg-stone-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
            "focus-within:relative focus-within:z-20"
          ),
          day_button: dayButtonNeutral,
          range_end: "day-range-end",
          selected: cn(
            "bg-stone-800 text-white",
            "hover:bg-stone-800 hover:text-white",
            "focus:bg-stone-800 focus:text-white"
          ),
          today: cn(
            "rounded-md border border-stone-300 bg-stone-50 font-medium text-stone-900",
            "data-[selected=true]:border-transparent"
          ),
          outside:
            "text-stone-400 opacity-70 aria-selected:bg-stone-100/80 aria-selected:text-stone-600 aria-selected:opacity-100",
          disabled: "text-stone-300 opacity-50",
          range_middle: "aria-selected:bg-stone-100 aria-selected:text-stone-900",
          hidden: "invisible",
          ...classNames,
        }}
        components={{
          Chevron: ({ orientation }) => {
            return orientation === "left" ? (
              <ChevronLeft className="h-4 w-4 text-stone-600" />
            ) : (
              <ChevronRight className="h-4 w-4 text-stone-600" />
            )
          },
        }}
        {...props}
      />
    </>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
