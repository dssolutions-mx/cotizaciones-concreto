import { ApexOptions } from 'apexcharts';
import { formatCurrency } from '../lib/utils';

// Common ApexCharts configurations
export const getApexCommonOptions = (): Partial<ApexOptions> => ({
  chart: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    toolbar: {
      show: false
    },
    animations: {
      enabled: true,
      speed: 800
    },
    dropShadow: {
      enabled: true,
      top: 2,
      left: 2,
      blur: 4,
      opacity: 0.15
    }
  },
  colors: ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'],
  stroke: {
    curve: 'smooth',
    width: [4, 3, 3, 3],
    dashArray: [0, 0, 0, 0]
  },
  fill: {
    type: 'gradient',
    gradient: {
      shade: 'light',
      type: 'vertical',
      shadeIntensity: 0.2,
      opacityFrom: 0.6,
      opacityTo: 0.1,
      stops: [0, 100]
    }
  },
  tooltip: {
    enabled: true,
    theme: 'light',
    style: {
      fontSize: '14px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }
  },
  grid: {
    show: true,
    borderColor: '#E5E7EB',
    strokeDashArray: 3,
    xaxis: {
      lines: {
        show: false
      }
    },
    yaxis: {
      lines: {
        show: true
      }
    },
    padding: {
      top: 20,
      right: 40,
      bottom: 20,
      left: 20
    }
  },
  legend: {
    position: 'top',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    markers: {
      size: 6,
      strokeWidth: 2,
      shape: 'circle' as const
    },
    itemMargin: {
      horizontal: 16,
      vertical: 8
    }
  }
});

export const getCashInvoiceChartOptions = (): ApexOptions => ({
  chart: {
    type: 'donut' as const,
    background: 'transparent',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    toolbar: {
      show: false
    },
    animations: {
      enabled: true,
      speed: 800
    },
    dropShadow: {
      enabled: true,
      top: 2,
      left: 2,
      blur: 4,
      opacity: 0.15
    }
  },
  colors: ['#10B981', '#3B82F6'],
  labels: ['Efectivo', 'Fiscal'],
  plotOptions: {
    pie: {
      donut: {
        size: '70%',
        background: 'transparent',
        labels: {
          show: true,
          name: {
            show: true,
            fontSize: '14px',
            fontWeight: 600,
            color: '#111827',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
          },
          value: {
            show: true,
            fontSize: '18px',
            fontWeight: 700,
            color: '#10B981',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
          },
          total: {
            show: true,
            showAlways: true,
            fontSize: '20px',
            fontWeight: 800,
            color: '#111827',
            label: 'Total',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            formatter: function (w: any) {
              // Calculate total from series data
              const total = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
              return formatCurrency(total);
            }
          }
        }
      },
      offsetX: 0,
      offsetY: 0
    }
  },
  stroke: {
    width: 5,
    colors: ['#ffffff']
  },
  dataLabels: {
    enabled: true,
    formatter: (val: number) => {
      if (val < 2) return '';
      return `${val.toFixed(1)}%`;
    },
    style: {
      fontSize: '10px',
      fontWeight: 600,
      colors: ['#ffffff'],
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    },
    background: {
      enabled: true,
      foreColor: '#111827',
      borderRadius: 4,
      padding: 2,
      opacity: 0.95
    },
    dropShadow: {
      enabled: true,
      top: 1,
      left: 1,
      blur: 1,
      opacity: 0.7
    }
  },
  legend: {
    position: 'bottom',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    markers: {
      size: 14
    },
    itemMargin: {
      horizontal: 20,
      vertical: 10
    }
  },
  tooltip: {
    enabled: true,
    theme: 'light',
    style: {
      fontSize: '15px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    },
    marker: {
      show: true
    }
  },
  states: {
    hover: {
      filter: {
        type: 'darken'
      }
    }
  },
  responsive: [{
    breakpoint: 480,
    options: {
      legend: {
        position: 'bottom',
        fontSize: '14px'
      }
    }
  }]
});

export const getProductCodeChartOptions = (includeVAT: boolean, productCodeAmountData: any[], productCodeVolumeData: any[]): ApexOptions => ({
  chart: {
    type: 'bar' as const,
    background: 'transparent',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    toolbar: {
      show: false
    },
    animations: {
      enabled: true,
      speed: 600
    },
    dropShadow: {
      enabled: true,
      top: 1,
      left: 1,
      blur: 3,
      opacity: 0.1
    }
  },
  colors: ['#10B981', '#059669', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5', '#ECFDF5', '#F0FDF4'],
  plotOptions: {
    bar: {
      horizontal: true,
      distributed: true,
      barHeight: '85%',
      borderRadius: 8,
      borderRadiusApplication: 'end',
      dataLabels: {
        position: 'bottom'
      }
    }
  },
  xaxis: {
    categories: (includeVAT ? productCodeAmountData : productCodeVolumeData).slice(0, 8).map(item => item.name),
    labels: {
      style: {
        fontSize: '12px',
        fontWeight: 600,
        colors: '#111827',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }
    },
    axisBorder: {
      show: false
    },
    axisTicks: {
      show: false
    }
  },
  yaxis: {
    labels: {
      style: {
        fontSize: '12px',
        fontWeight: 600,
        colors: '#111827',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }
    }
  },
  dataLabels: {
    enabled: true,
    formatter: (val: number) => includeVAT ? `$${val.toFixed(0)}` : `${val.toFixed(1)} m³`,
    offsetX: 12,
    style: {
      fontSize: '11px',
      fontWeight: 700,
      colors: ['#ffffff'],
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    },
    background: {
      enabled: true,
      foreColor: '#111827',
      borderRadius: 4,
      padding: 3,
      opacity: 0.95
    }
  },
  tooltip: {
    enabled: true,
    theme: 'light',
    style: {
      fontSize: '12px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    },
    y: {
      formatter: (val: number) => includeVAT ? `$${val.toFixed(2)}` : `${val.toFixed(2)} m³`
    },
    marker: {
      show: true
    }
  },
  grid: {
    show: false
  },
  legend: {
    show: false
  }
});

export const getClientChartOptions = (includeVAT: boolean, clientAmountData: any[], clientVolumeData: any[]): ApexOptions => ({
  chart: {
    type: 'pie' as const,
    background: 'transparent',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    toolbar: {
      show: false
    },
    animations: {
      enabled: true,
      speed: 700
    },
    dropShadow: {
      enabled: true,
      top: 2,
      left: 2,
      blur: 4,
      opacity: 0.15
    }
  },
  colors: ['#10B981', '#059669', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5', '#ECFDF5', '#F0FDF4'],
  labels: (includeVAT ? clientAmountData : clientVolumeData).map(item => item.name).slice(0, 6).concat((includeVAT ? clientAmountData : clientVolumeData).length > 6 ? ['Otros'] : []),
  dataLabels: {
    enabled: true,
    formatter: (val: number) => {
      if (val < 2) return '';
      return `${val.toFixed(1)}%`;
    },
    style: {
      fontSize: '13px',
      fontWeight: 700,
      colors: ['#ffffff'],
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    },
    background: {
      enabled: true,
      foreColor: '#111827',
      borderRadius: 6,
      padding: 4,
      opacity: 0.95
    },
    dropShadow: {
      enabled: true,
      blur: 2,
      opacity: 0.8
    }
  },
  stroke: {
    width: 4,
    colors: ['#ffffff']
  },
  legend: {
    position: 'bottom',
    fontSize: '16px',
    fontWeight: 700,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    formatter: (seriesName: string, opts: any) => {
      const name = seriesName.length > 25 ? seriesName.substring(0, 25) + '...' : seriesName;
      const percentage = opts.w.globals.series[opts.seriesIndex] /
        opts.w.globals.series.reduce((a: number, b: number) => a + b, 0) * 100;
      const percentText = percentage > 1 ? ` (${percentage.toFixed(1)}%)` : '';
      return `${name}${percentText}`;
    },
    markers: {
      size: 14
    },
    itemMargin: {
      horizontal: 20,
      vertical: 10
    }
  },
  tooltip: {
    enabled: true,
    theme: 'light',
    style: {
      fontSize: '14px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    },
    marker: {
      show: true
    }
  },
  plotOptions: {
    pie: {
      expandOnClick: false,
      donut: {
        size: '0%'
      }
    }
  },
  responsive: [{
    breakpoint: 768,
    options: {
      legend: {
        position: 'bottom',
        fontSize: '13px',
        itemMargin: {
          horizontal: 12,
          vertical: 6
        }
      }
    }
  }]
});

export const getSalesTrendChartOptions = (includeVAT: boolean): ApexOptions => {
  const categories = [];
  for (let i = 23; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    categories.push(date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }));
  }

  return {
    chart: {
      type: 'line' as const,
      background: 'transparent',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        }
      },
      animations: {
        enabled: true,
        speed: 1000,
        animateGradually: {
          enabled: true,
          delay: 150
        }
      },
      dropShadow: {
        enabled: true,
        top: 3,
        left: 3,
        blur: 6,
        opacity: 0.2
      }
    },
    colors: ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'],
    stroke: {
      curve: 'smooth',
      width: [4, 3, 3, 3],
      dashArray: [0, 0, 0, 0]
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'light',
        type: 'vertical',
        shadeIntensity: 0.2,
        opacityFrom: 0.6,
        opacityTo: 0.1,
        stops: [0, 100]
      }
    },
    xaxis: {
      categories,
      labels: {
        style: {
          fontSize: '12px',
          fontWeight: 500,
          colors: '#374151',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        },
        rotate: -45,
        rotateAlways: false,
        hideOverlappingLabels: true
      },
      axisBorder: {
        show: true,
        color: '#D1D5DB'
      },
      axisTicks: {
        show: true,
        color: '#D1D5DB'
      },
      crosshairs: {
        show: true,
        width: 1,
        position: 'back',
        opacity: 0.9,
        stroke: {
          color: '#775DD0',
          width: 1,
          dashArray: 3
        }
      }
    },
    yaxis: [
      {
        labels: {
          style: {
            fontSize: '12px',
            fontWeight: 500,
            colors: '#10B981',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
          },
          formatter: (val: number) => {
            if (val === null || val === undefined || isNaN(val)) {
              return 'Sin datos';
            }
            return includeVAT ? `$${val.toFixed(0)}` : `$${val.toFixed(0)}`;
          }
        },
        axisBorder: {
          show: true,
          color: '#10B981'
        },
        title: {
          text: includeVAT ? 'Ventas (Con IVA)' : 'Ventas (Sin IVA)',
          style: {
            color: '#10B981',
            fontSize: '12px',
            fontWeight: '600'
          }
        }
      },
      {
        opposite: true,
        labels: {
          style: {
            fontSize: '12px',
            fontWeight: 500,
            colors: '#3B82F6',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
          },
          formatter: (val: number) => {
            if (val === null || val === undefined || isNaN(val)) {
              return 'Sin datos';
            }
            return `${val.toFixed(0)} m³`;
          }
        },
        axisBorder: {
          show: true,
          color: '#3B82F6'
        },
        title: {
          text: 'Volumen (m³)',
          style: {
            color: '#3B82F6',
            fontSize: '12px',
            fontWeight: '600'
          }
        }
      }
    ],
    dataLabels: {
      enabled: false
    },
    tooltip: {
      enabled: true,
      theme: 'light',
      style: {
        fontSize: '14px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      },
      y: {
        formatter: (val: number, { seriesIndex, seriesName }: any) => {
          if (val === null || val === undefined || isNaN(val)) {
            return 'Sin datos';
          }

          if (seriesIndex === 0) {
            return includeVAT ? `$${val.toFixed(0)}` : `$${val.toFixed(0)}`;
          }

          return `${val.toFixed(1)} m³`;
        }
      },
      x: {
        show: true,
        formatter: (val: any) => `Período: ${val}`
      },
      marker: {
        show: true
      }
    },
    grid: {
      show: true,
      borderColor: '#E5E7EB',
      strokeDashArray: 3,
      xaxis: {
        lines: {
          show: false
        }
      },
      yaxis: {
        lines: {
          show: true
        }
      },
      padding: {
        top: 20,
        right: 40,
        bottom: 20,
        left: 20
      }
    },
    legend: {
      position: 'top',
      fontSize: '14px',
      fontWeight: 600,
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      markers: {
        size: 6,
        strokeWidth: 2,
        shape: 'circle' as const
      },
      itemMargin: {
        horizontal: 16,
        vertical: 8
      }
    },
    markers: {
      size: [6, 5, 5, 5],
      colors: ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'],
      strokeColors: '#fff',
      strokeWidth: 2,
      hover: {
        size: 8
      }
    },
    annotations: {
      xaxis: [
        {
          x: categories[categories.length - 4],
          strokeDashArray: 0,
          borderColor: '#10B981',
          label: {
            borderColor: '#10B981',
            style: {
              color: '#fff',
              background: '#10B981'
            },
            text: 'Tendencia Reciente'
          }
        }
      ]
    },
    responsive: [
      {
        breakpoint: 768,
        options: {
          xaxis: {
            labels: {
              rotate: -90,
              style: {
                fontSize: '10px'
              }
            }
          },
          legend: {
            position: 'bottom',
            fontSize: '12px'
          }
        }
      }
    ]
  };
};

export const getActiveClientsChartOptions = (): ApexOptions => ({
  chart: {
    type: 'bar' as const,
    background: 'transparent',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    toolbar: {
      show: false
    },
    animations: {
      enabled: true,
      speed: 700
    },
    dropShadow: {
      enabled: true,
      top: 1,
      left: 1,
      blur: 3,
      opacity: 0.15
    }
  },
  colors: ['#8B5CF6'],
  plotOptions: {
    bar: {
      horizontal: false,
      borderRadius: 8,
      dataLabels: {
        position: 'top'
      }
    }
  },
  xaxis: {
    categories: [], // Will be populated dynamically
    labels: {
      style: {
        fontSize: '12px',
        fontWeight: 600,
        colors: '#111827',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }
    }
  },
  yaxis: {
    labels: {
      style: {
        fontSize: '12px',
        fontWeight: 600,
        colors: '#111827',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }
    }
  },
  dataLabels: {
    enabled: true,
    formatter: (val: number) => val.toString(),
    style: {
      fontSize: '11px',
      fontWeight: 700,
      colors: ['#ffffff'],
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    },
    background: {
      enabled: true,
      foreColor: '#111827',
      borderRadius: 4,
      padding: 3,
      opacity: 0.95
    }
  },
  tooltip: {
    enabled: true,
    theme: 'light',
    style: {
      fontSize: '14px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    },
    y: {
      formatter: (val: number) => `${val} clientes`
    }
  },
  grid: {
    show: false
  }
});

export const getPaymentPerformanceChartOptions = (): ApexOptions => ({
  chart: {
    type: 'radialBar' as const,
    background: 'transparent',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    toolbar: {
      show: false
    },
    animations: {
      enabled: true,
      speed: 800
    }
  },
  colors: ['#10B981'],
  plotOptions: {
    radialBar: {
      startAngle: -135,
      endAngle: 135,
      hollow: {
        margin: 15,
        size: '75%'
      },
      track: {
        background: '#E5E7EB',
        strokeWidth: '97%',
        margin: 5
      },
      dataLabels: {
        name: {
          show: true,
          fontSize: '18px',
          fontWeight: 600,
          color: '#374151',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        },
        value: {
          show: true,
          fontSize: '28px',
          fontWeight: 800,
          color: '#10B981',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }
      }
    }
  },
  fill: {
    type: 'gradient',
    gradient: {
      shade: 'light',
      type: 'horizontal',
      shadeIntensity: 0.4,
      gradientToColors: ['#34D399'],
      inverseColors: false,
      opacityFrom: 1,
      opacityTo: 1,
      stops: [0, 100]
    }
  },
  stroke: {
    lineCap: 'round',
    width: 3
  }
});

export const getOutstandingAmountsChartOptions = (): ApexOptions => ({
  chart: {
    type: 'bar' as const,
    background: 'transparent',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    toolbar: {
      show: false
    },
    animations: {
      enabled: true,
      speed: 700
    },
    dropShadow: {
      enabled: true,
      top: 1,
      left: 1,
      blur: 3,
      opacity: 0.15
    }
  },
  colors: ['#EF4444'],
  plotOptions: {
    bar: {
      horizontal: false,
      borderRadius: 8,
      dataLabels: {
        position: 'top'
      }
    }
  },
  xaxis: {
    categories: [], // Will be populated dynamically
    labels: {
      style: {
        fontSize: '12px',
        fontWeight: 600,
        colors: '#111827',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }
    }
  },
  yaxis: {
    labels: {
      style: {
        fontSize: '12px',
        fontWeight: 600,
        colors: '#111827',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      },
      formatter: (val: number) => `$${val.toFixed(0)}`
    }
  },
  dataLabels: {
    enabled: true,
    formatter: (val: number) => `$${val.toFixed(0)}`,
    style: {
      fontSize: '10px',
      fontWeight: 700,
      colors: ['#ffffff'],
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    },
    background: {
      enabled: true,
      foreColor: '#111827',
      borderRadius: 4,
      padding: 3,
      opacity: 0.95
    }
  },
  tooltip: {
    enabled: true,
    theme: 'light',
    style: {
      fontSize: '14px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    },
    y: {
      formatter: (val: number) => `$${val.toFixed(0)}`
    }
  },
  grid: {
    show: false
  }
});
