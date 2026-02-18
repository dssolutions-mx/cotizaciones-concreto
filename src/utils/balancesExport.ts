import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';

// --- All Balances Export ---

export interface ClientBalanceRow {
  client_id: string;
  client_code: string;
  business_name: string;
  total_consumed: number;
  total_paid: number;
  adjustments: number;
  current_balance: number;
  expected_arithmetic: number;
  last_payment_date: string | null;
  last_delivery_date: string | null;
}

export function exportAllBalancesToExcel(rows: ClientBalanceRow[]) {
  try {
    const DEFAULT_VAT = 0.16;

    const formatNum = (n: number) =>
      Number(n ?? 0).toLocaleString('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    const formatDateCell = (d: string | null) => {
      if (!d) return 'N/A';
      const parsed = d.includes('T') ? new Date(d) : new Date(d + 'T12:00:00');
      return isValid(parsed) ? format(parsed, 'dd/MM/yyyy', { locale: es }) : 'N/A';
    };

    const excelRows = rows.map((r) => ({
      'Código Cliente': r.client_code ?? '',
      'Razón Social': r.business_name ?? '',
      'Total Consumido': formatNum(r.total_consumed),
      'Total Pagos': formatNum(r.total_paid),
      'Ajustes': formatNum(r.adjustments),
      'Saldo Actual': formatNum(r.current_balance),
      'Esperado (aritmético)': formatNum(r.expected_arithmetic),
      'Último Pago': formatDateCell(r.last_payment_date),
      'Última Entrega': formatDateCell(r.last_delivery_date),
    }));

    const totalSaldo = rows.reduce((s, r) => s + (r.current_balance ?? 0), 0);
    const clientsWithBalance = rows.filter((r) => (r.current_balance ?? 0) > 0).length;

    excelRows.push({
      'Código Cliente': 'TOTAL',
      'Razón Social': '',
      'Total Consumido': '',
      'Total Pagos': '',
      'Ajustes': '',
      'Saldo Actual': formatNum(totalSaldo),
      'Esperado (aritmético)': '',
      'Último Pago': '',
      'Última Entrega': `Clientes con saldo: ${clientsWithBalance}`,
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelRows);

    const colWidths = [
      { wch: 14 },
      { wch: 35 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 12 },
      { wch: 14 },
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Resumen Balances');

    const filename = `Reporte_Balances_Clientes_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, filename);

    return { success: true, filename };
  } catch (err) {
    console.error('Error exporting balances to Excel:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// --- Single Client Research Export ---

export interface ClientResearchOrder {
  order_number: string;
  construction_site: string;
  final_amount: number;
  amount_con_iva: number;
  delivery_date: string;
}

export interface ClientResearchPayment {
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  construction_site: string | null;
}

export interface ClientResearchAdjustment {
  created_at: string;
  adjustment_type: string;
  amount: number;
  effect_on_client: number;
  notes: string;
}

export interface ClientResearchData {
  client_id: string;
  client_name: string;
  orders: ClientResearchOrder[];
  payments: ClientResearchPayment[];
  adjustments: ClientResearchAdjustment[];
  summary: {
    total_consumed: number;
    total_paid: number;
    adjustments: number;
    current_balance: number;
  };
}

export function exportClientResearchToExcel(data: ClientResearchData) {
  try {
    const formatNum = (n: number) =>
      Number(n ?? 0).toLocaleString('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    const formatDateCell = (d: string) => {
      const parsed = d.includes('T') ? new Date(d) : new Date(d + 'T12:00:00');
      return isValid(parsed) ? format(parsed, 'dd/MM/yyyy', { locale: es }) : d;
    };

    const wb = XLSX.utils.book_new();

    // Orders sheet
    const orderRows = data.orders.map((o) => ({
      'Número Orden': o.order_number,
      'Obra': o.construction_site,
      'Monto Final': formatNum(o.final_amount),
      'Monto con IVA': formatNum(o.amount_con_iva),
      'Fecha Entrega': formatDateCell(o.delivery_date),
    }));
    orderRows.push({
      'Número Orden': 'TOTAL CONSUMIDO',
      'Obra': '',
      'Monto Final': formatNum(data.summary.total_consumed),
      'Monto con IVA': '',
      'Fecha Entrega': '',
    });
    const wsOrders = XLSX.utils.json_to_sheet(orderRows);
    wsOrders['!cols'] = [{ wch: 18 }, { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsOrders, 'Órdenes');

    // Payments sheet
    const paymentRows = data.payments.map((p) => ({
      'Fecha': formatDateCell(p.payment_date),
      'Monto': formatNum(p.amount),
      'Método': p.payment_method,
      'Referencia': p.reference_number ?? '',
      'Obra': p.construction_site ?? '',
    }));
    paymentRows.push({
      'Fecha': 'TOTAL PAGOS',
      'Monto': formatNum(data.summary.total_paid),
      'Método': '',
      'Referencia': '',
      'Obra': '',
    });
    const wsPayments = XLSX.utils.json_to_sheet(paymentRows);
    wsPayments['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsPayments, 'Pagos');

    // Adjustments sheet
    const adjRows = data.adjustments.map((a) => ({
      'Fecha': formatDateCell(a.created_at),
      'Tipo': a.adjustment_type,
      'Monto': formatNum(a.amount),
      'Efecto en Cliente': formatNum(a.effect_on_client),
      'Notas': a.notes ?? '',
    }));
    adjRows.push({
      'Fecha': 'TOTAL AJUSTES',
      'Tipo': '',
      'Monto': '',
      'Efecto en Cliente': formatNum(data.summary.adjustments),
      'Notas': '',
    });
    const wsAdj = XLSX.utils.json_to_sheet(adjRows);
    wsAdj['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsAdj, 'Ajustes');

    // Summary sheet
    const summaryRows = [
      { Concepto: 'Total Consumido', Valor: formatNum(data.summary.total_consumed) },
      { Concepto: 'Total Pagos', Valor: formatNum(data.summary.total_paid) },
      { Concepto: 'Ajustes', Valor: formatNum(data.summary.adjustments) },
      { Concepto: 'Saldo', Valor: formatNum(data.summary.current_balance) },
      {
        Concepto: 'Verificación',
        Valor:
          formatNum(
            data.summary.total_consumed - data.summary.total_paid + data.summary.adjustments
          ) +
          (Math.abs(
            data.summary.total_consumed -
              data.summary.total_paid +
              data.summary.adjustments -
              data.summary.current_balance
          ) < 0.01
            ? ' (OK)'
            : ' (revisar)'),
      },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 22 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

    const safeName = (data.client_name || 'Cliente').replace(/[\\/*?:[\]]/g, '_').slice(0, 25);
    const filename = `Investigacion_${safeName}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, filename);

    return { success: true, filename };
  } catch (err) {
    console.error('Error exporting client research to Excel:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
