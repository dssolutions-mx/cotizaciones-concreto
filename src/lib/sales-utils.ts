import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Format a number as currency with proper formatting
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Format number with units (K, M) for large numbers
 */
export const formatNumberWithUnits = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  } else {
    return value.toFixed(2);
  }
};

/**
 * Format date for display
 */
export const formatDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return format(dateObj, 'dd/MM/yyyy', { locale: es });
};

/**
 * Get last 6 months for trend charts
 */
export const getLast6Months = (): string[] => {
  const months = [];
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthNames[date.getMonth()]);
  }
  return months;
};

/**
 * Common ApexCharts configuration options
 */
export const getApexCommonOptions = () => ({
  chart: {
    toolbar: {
      show: false
    },
    background: 'transparent',
    fontFamily: 'Inter, system-ui, sans-serif',
    animations: {
      enabled: true,
      speed: 300,
      dynamicAnimation: {
        speed: 150
      }
    }
  },
  colors: ['#3EB56D', '#2D8450', '#5DC78A', '#206238', '#83D7A5'], // Company green palette
  dataLabels: {
    enabled: false // Disabled for cleaner look
  },
  legend: {
    position: 'bottom' as const,
    fontSize: '12px',
    fontWeight: 500,
    markers: {
      size: 6
    },
    itemMargin: {
      horizontal: 10,
      vertical: 0
    }
  },
  stroke: {
    curve: 'smooth' as const,
    width: 2
  },
  tooltip: {
    y: {
      formatter: (val: number) => formatCurrency(val)
    },
    theme: 'light',
    style: {
      fontSize: '12px',
      fontFamily: 'Inter, system-ui, sans-serif'
    }
  },
  grid: {
    borderColor: '#f1f5f9',
    strokeDashArray: 4,
    padding: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    }
  }
});

/**
 * Calculate date range text for display
 */
export const getDateRangeText = (startDate: Date | undefined, endDate: Date | undefined): string => {
  if (!startDate || !endDate) return 'Seleccione un rango de fechas';
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

/**
 * VAT rate constant
 */
export const VAT_RATE = 0.16;

/**
 * Validate date object
 */
export const isValidDate = (date: any): boolean => {
  return date instanceof Date && !isNaN(date.getTime());
};
