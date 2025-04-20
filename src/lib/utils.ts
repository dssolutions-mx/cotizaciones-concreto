import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format as formatFn, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Function to format currency (MXN)
export function formatCurrency(amount: number | null | undefined): string {
  const formatter = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(amount ?? 0);
}

// Function to format dates
export function formatDate(date: string | Date | null | undefined, formatString = 'PP'): string {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  
  try {
    return formatFn(dateObj, formatString, { locale: es });
  } catch (error) {
    console.error("Error formatting date:", error);
    // Attempt fallback formats or return original string representation if possible
    if (date instanceof Date) {
      return date.toLocaleDateString('es-MX'); // Fallback to basic locale string
    }
    return String(date); // Fallback to string conversion
  }
}
