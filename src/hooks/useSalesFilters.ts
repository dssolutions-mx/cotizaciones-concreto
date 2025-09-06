import { useState, useMemo } from 'react';

interface UseSalesFiltersProps {
  remisionesData: any[];
  salesData: any[];
}

export const useSalesFilters = ({ remisionesData, salesData }: UseSalesFiltersProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [resistanceFilter, setResistanceFilter] = useState<string>('all');
  const [efectivoFiscalFilter, setEfectivoFiscalFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [codigoProductoFilter, setCodigoProductoFilter] = useState<string>('all');
  const [layoutType, setLayoutType] = useState<'current' | 'powerbi'>('powerbi');

  // Filter remisiones by client and search term
  const filteredRemisiones = useMemo(() => {
    let filtered = [...remisionesData];

    // Apply client filter - now using 'all' instead of empty string
    if (clientFilter && clientFilter !== 'all') {
      filtered = filtered.filter(r => r.order?.client_id === clientFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.remision_number?.toLowerCase().includes(term) ||
        r.order?.order_number?.toLowerCase().includes(term) ||
        r.order?.clients?.business_name?.toLowerCase().includes(term) ||
        r.recipe?.recipe_code?.toLowerCase().includes(term)
      );
    }

    // --- Apply PowerBI Filters ---
    if (layoutType === 'powerbi') {
      // Resistance Filter
      if (resistanceFilter && resistanceFilter !== 'all') {
        filtered = filtered.filter(r => r.recipe?.strength_fc?.toString() === resistanceFilter);
      }

      // Efectivo/Fiscal Filter
      if (efectivoFiscalFilter && efectivoFiscalFilter !== 'all') {
        const requiresInvoice = efectivoFiscalFilter === 'fiscal';
        filtered = filtered.filter(r => {
          const order = salesData.find(o => o.id === r.order_id);
          return order?.requires_invoice === requiresInvoice;
        });
      }

      // Tipo Filter
      if (tipoFilter && tipoFilter !== 'all') {
        filtered = filtered.filter(r => r.tipo_remision === tipoFilter);
      }

      // Codigo Producto Filter
      if (codigoProductoFilter && codigoProductoFilter !== 'all') {
        filtered = filtered.filter(r => r.recipe?.recipe_code === codigoProductoFilter);
      }
    }

    return filtered;
  }, [remisionesData, clientFilter, searchTerm, layoutType, resistanceFilter, efectivoFiscalFilter, tipoFilter, codigoProductoFilter, salesData]);

  // Create virtual remisiones entries for "vacío de olla" orders
  const filteredRemisionesWithVacioDeOlla = useMemo(() => {
    // Start with the regular filtered remisiones
    const combinedRemisiones = [...filteredRemisiones];

    // Get orders that match current filters
    let filteredOrders = [...salesData];

    // Apply client filter to orders
    if (clientFilter && clientFilter !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.client_id === clientFilter);
    }

    // Create virtual remisiones for vacío de olla
    filteredOrders.forEach(order => {
      // Find vacío de olla items
      const emptyTruckItem = order.items?.find(
        (item: any) =>
          item.product_type === 'VACÍO DE OLLA' ||
          item.product_type === 'EMPTY_TRUCK_CHARGE' ||
          item.has_empty_truck_charge === true
      );

      if (emptyTruckItem) {
        // Find the remision with the lowest volume for this order to assign its number
        const orderRemisiones = remisionesData.filter(r => r.order_id === order.id);

        // Only create virtual remision if there are actual remisiones for this order
        if (orderRemisiones.length > 0) {
          // Sort by volume ascending and take the first one (lowest volume)
          const sortedRemisiones = orderRemisiones.sort((a, b) =>
            (a.volumen_fabricado || 0) - (b.volumen_fabricado || 0)
          );
          const assignedRemisionNumber = sortedRemisiones[0].remision_number;

          // Create a virtual remision object for this vacío de olla item
          const virtualRemision = {
            id: `vacio-${order.id}-${emptyTruckItem.id}`,
            remision_number: assignedRemisionNumber,
            order_id: order.id,
            fecha: order.delivery_date,
            tipo_remision: 'VACÍO DE OLLA',
            volumen_fabricado: parseFloat(emptyTruckItem.empty_truck_volume) || parseFloat(emptyTruckItem.volume) || 1,
            recipe: { recipe_code: 'SER001' },
            order: {
              client_id: order.client_id,
              order_number: order.order_number,
              clients: order.clients,
              requires_invoice: order.requires_invoice
            },
            isVirtualVacioDeOlla: true,
            originalOrderItem: emptyTruckItem
          };

          combinedRemisiones.push(virtualRemision);
        }
      }
    });

    return combinedRemisiones;
  }, [filteredRemisiones, salesData, clientFilter]);

  return {
    // State
    searchTerm,
    setSearchTerm,
    clientFilter,
    setClientFilter,
    resistanceFilter,
    setResistanceFilter,
    efectivoFiscalFilter,
    setEfectivoFiscalFilter,
    tipoFilter,
    setTipoFilter,
    codigoProductoFilter,
    setCodigoProductoFilter,
    layoutType,
    setLayoutType,

    // Filtered data
    filteredRemisiones,
    filteredRemisionesWithVacioDeOlla,
  };
};
