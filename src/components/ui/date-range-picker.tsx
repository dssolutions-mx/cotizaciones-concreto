/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"
import { addDays, format } from "date-fns"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerWithRangeProps {
  className?: string
  value: DateRange | undefined
  onChange: (date: DateRange | undefined) => void
}

export function DatePickerWithRange({
  className,
  value,
  onChange,
}: DatePickerWithRangeProps) {
  const label = value?.from
    ? value.to
      ? `${format(value.from, "dd/MM/yy")} – ${format(value.to, "dd/MM/yy")}`
      : format(value.from, "dd/MM/yy")
    : "Seleccionar fechas"

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "h-9 justify-start gap-2 border-stone-200 bg-white text-sm font-normal text-stone-700 hover:bg-stone-50",
              !value && "text-stone-400"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-stone-500" />
            <span>{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 shadow-lg ring-1 ring-stone-200"
          align="start"
          sideOffset={6}
        >
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
} 