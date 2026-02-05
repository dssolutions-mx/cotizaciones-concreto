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

// Function to format number with thousand separators (commas) for input fields
export function formatNumberWithCommas(value: string | number): string {
  if (value === '' || value === null || value === undefined) return '';
  
  // Remove all non-digit characters except decimal point
  const numericString = String(value).replace(/[^\d.]/g, '');
  
  if (numericString === '' || numericString === '.') return numericString;
  
  // Split by decimal point
  const parts = numericString.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  // Format integer part with commas
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  // Combine with decimal part if exists
  return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger;
}

// Function to parse formatted number string back to number
export function parseFormattedNumber(value: string): number | null {
  if (!value || value.trim() === '') return null;
  
  // Remove commas and parse
  const numericString = value.replace(/,/g, '');
  const parsed = parseFloat(numericString);
  
  return isNaN(parsed) ? null : parsed;
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

// Function to format UTC timestamps with timezone conversion
export function formatTimestamp(timestamp: string | null | undefined, formatString = 'PPp'): string {
  if (!timestamp) return 'No disponible';

  try {
    // Parse the ISO timestamp string (UTC from Supabase)
    const dateObj = parseISO(timestamp);
    
    // Validate the date object
    if (!isValidDate(dateObj)) {
      console.error("Invalid timestamp:", timestamp);
      return 'Fecha inválida';
    }

    // Format using date-fns - browser will automatically convert to local timezone
    return formatFn(dateObj, formatString, { locale: es });
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    // Fallback: try to parse as Date and use locale string
    try {
      const fallbackDate = new Date(timestamp);
      if (isValidDate(fallbackDate)) {
        return fallbackDate.toLocaleString('es-MX', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (fallbackError) {
      console.error("Fallback date parsing failed:", fallbackError);
    }
    return 'No disponible';
  }
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
