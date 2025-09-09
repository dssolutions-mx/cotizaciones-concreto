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

// Function to format numbers with specified decimal places
export function formatNumber(num: number, decimals: number = 1): string {
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

// Function to format dates
export function formatDate(date: string | Date | null | undefined, formatString = 'PP'): string {
  if (!date) return 'N/A';

  // If string is a simple YYYY-MM-DD, add T12:00:00 to avoid timezone shifts
  const dateObj = typeof date === 'string'
    ? (date.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? parseISO(`${date}T12:00:00`)
        : parseISO(date))
    : date;

  // Validate the date object before formatting
  if (!isValidDate(dateObj)) {
    console.error("Invalid date object:", dateObj);
    return 'Fecha inválida';
  }

  try {
    return formatFn(dateObj, formatString, { locale: es });
  } catch (error) {
    console.error("Error formatting date:", error);
    // Attempt fallback formats or return original string representation if possible
    if (dateObj instanceof Date) {
      return dateObj.toLocaleDateString('es-MX'); // Fallback to basic locale string
    }
    return String(date); // Fallback to string conversion
  }
}

// Helper function to safely create date objects without timezone issues
export function createSafeDate(dateStr: string | Date | null | undefined): Date | null {
  if (!dateStr) return null;

  if (typeof dateStr === 'string') {
    // If the date is just YYYY-MM-DD without time, add noon time to prevent timezone shifts
    if (dateStr.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(`${dateStr}T12:00:00`);
    }
    return parseISO(dateStr);
  }

  return dateStr;
}

// Helper function to safely validate if a value is a valid Date object
export function isValidDate(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime()) && date.getTime() > 0;
}

// Helper function to safely format dates with fallback
export function safeFormatDate(date: any, formatString = 'PP'): string {
  if (isValidDate(date)) {
    try {
      return formatFn(date, formatString, { locale: es });
    } catch (error) {
      console.error('Error formatting date:', error);
      return date.toLocaleDateString('es-MX');
    }
  }
  return 'N/A';
}

// Helper function to get a safe Date object, returning current date as fallback
export function getSafeDate(date: any): Date {
  return isValidDate(date) ? date : new Date();
}

// Debug helper to test date validation (can be removed in production)
export function debugDateValidation(testDates: any[]): void {
  console.log('=== Date Validation Debug ===');
  testDates.forEach((date, index) => {
    console.log(`Date ${index}:`, {
      value: date,
      isValid: isValidDate(date),
      type: typeof date,
      instanceof: date instanceof Date,
      getTime: date instanceof Date ? date.getTime() : 'N/A',
      isNaN: date instanceof Date ? isNaN(date.getTime()) : 'N/A'
    });
  });
  console.log('=== End Debug ===');
}
