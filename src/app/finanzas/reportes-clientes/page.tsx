'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from "react-day-picker";
import { PDFDownloadLink } from '@react-pdf/renderer';

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangePickerWithPresets } from "@/components/ui/date-range-picker-with-presets";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";

// Icons
import { 
  Download, 
  FileText, 
  Settings, 
  Eye, 
  Search, 
  ChevronDown, 
  X,
  Filter,
  BarChart3,
  FileSpreadsheet
} from 'lucide-react';

// Services and Types
import { ReportDataService } from '@/services/reportDataService';
import type { 
  ReportFilter, 
  ReportConfiguration, 
  ReportRemisionData, 
  ReportSummary,
  ReportColumn
} from '@/types/pdf-reports';
import { 
  AVAILABLE_COLUMNS, 
  DEFAULT_COLUMN_SETS, 
  DEFAULT_TEMPLATES 
} from '@/types/pdf-reports';

// Components
import ClientReportPDF from '@/components/reports/ClientReportPDF';
import { formatCurrency } from '@/lib/utils';

export default function ReportesClientes() {
  // State for filters
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [singleDateMode, setSingleDateMode] = useState<boolean>(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedSite, setSelectedSite] = useState<string>('todos');
  const [selectedRecipe, setSelectedRecipe] = useState<string>('all');
  const [invoiceRequirement, setInvoiceRequirement] = useState<string>('all');

  // State for data
  const [clients, setClients] = useState<any[]>([]);
  const [clientSites, setClientSites] = useState<string[]>([]);
  const [recipeCodes, setRecipeCodes] = useState<string[]>([]);
  const [reportData, setReportData] = useState<ReportRemisionData[]>([]);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  
  // State for UI
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [clientComboboxOpen, setClientComboboxOpen] = useState(false);
  
  // State for report configuration
  const [selectedColumns, setSelectedColumns] = useState<ReportColumn[]>(
    AVAILABLE_COLUMNS.filter(col => DEFAULT_COLUMN_SETS.company_standard.includes(col.id))
  );
  const [selectedTemplate, setSelectedTemplate] = useState<string>('company-standard');
  const [reportTitle, setReportTitle] = useState<string>('Reporte Estándar de Entregas por Cliente');
  const [showSummary, setShowSummary] = useState<boolean>(true);
  const [showVAT, setShowVAT] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('filters');

  // Load clients with remisiones when date range changes
  const loadClientsWithRemisiones = useCallback(async () => {
    if (!dateRange.from || !dateRange.to) return;
    
    setLoadingClients(true);
    try {
      const clientsData = await ReportDataService.getClientsWithRemisiones({
        from: dateRange.from,
        to: dateRange.to
      });
      setClients(clientsData);
    } catch (error) {
      console.error('Error loading clients:', error);
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  }, [dateRange]);

  // Load recipe codes
  const loadRecipeCodes = useCallback(async () => {
    if (!dateRange.from || !dateRange.to) return;
    
    setLoadingFilters(true);
    try {
      // Only load recipe codes if a client is selected
      if (selectedClientId) {
        const codes = await ReportDataService.getAvailableRecipeCodes({
          from: dateRange.from,
          to: dateRange.to
        }, selectedClientId);
        setRecipeCodes(codes);
      } else {
        setRecipeCodes([]);
      }
    } catch (error) {
      console.error('Error loading recipe codes:', error);
      setRecipeCodes([]);
    } finally {
      setLoadingFilters(false);
    }
  }, [dateRange, selectedClientId]);

  // Load client construction sites when client is selected
  const loadClientSites = useCallback(async () => {
    if (!selectedClientId || !dateRange.from || !dateRange.to) {
      setClientSites([]);
      return;
    }

    try {
      const sites = await ReportDataService.getClientConstructionSites(selectedClientId, {
        from: dateRange.from,
        to: dateRange.to
      });
      setClientSites(sites);
    } catch (error) {
      console.error('Error loading client sites:', error);
      setClientSites([]);
    }
  }, [selectedClientId, dateRange]);

  // Fetch report data
  const fetchReportData = useCallback(async () => {
    if (!selectedClientId || !dateRange.from || !dateRange.to) return;
    
    setLoading(true);
    try {
      const filters: ReportFilter = {
        dateRange,
        clientId: selectedClientId,
        constructionSite: selectedSite !== 'todos' ? selectedSite : undefined,
        recipeCode: selectedRecipe !== 'all' ? selectedRecipe : undefined,
        invoiceRequirement: invoiceRequirement !== 'all' ? 
          invoiceRequirement as 'with_invoice' | 'without_invoice' : undefined,
        singleDateMode
      };

      const result = await ReportDataService.fetchReportData(filters);
      setReportData(result.data);
      setReportSummary(result.summary);
      
      // Don't automatically switch tabs - let user choose when to view preview
    } catch (error) {
      console.error('Error fetching report data:', error);
      setReportData([]);
      setReportSummary(null);
    } finally {
      setLoading(false);
    }
  }, [selectedClientId, dateRange, selectedSite, selectedRecipe, invoiceRequirement, singleDateMode]);

  // Effects
  useEffect(() => {
    loadClientsWithRemisiones();
    loadRecipeCodes();
  }, [loadClientsWithRemisiones, loadRecipeCodes]);

  useEffect(() => {
    loadClientSites();
  }, [loadClientSites]);

  // Reset filters when date range changes
  useEffect(() => {
    if (dateRange.from && dateRange.to) {
      // Reset client selection when date range changes
      setSelectedClientId('');
      setReportData([]);
      setReportSummary(null);
      setRecipeCodes([]); // Clear recipe codes when date range changes
      // Reload available clients for new date range
      loadClientsWithRemisiones();
    }
  }, [dateRange.from, dateRange.to]);

  useEffect(() => {
    if (selectedClientId) {
      // Load recipe codes and construction sites for the selected client
      loadRecipeCodes();
      loadClientSites();
    }
  }, [selectedClientId, loadRecipeCodes, loadClientSites]);

  // Filtered clients for search
  const filteredClients = useMemo(() => {
    if (!clientSearchTerm) return clients;
    
    const searchTerm = clientSearchTerm.toLowerCase();
    return clients.filter(client => 
      client.business_name?.toLowerCase().includes(searchTerm) ||
      client.name?.toLowerCase().includes(searchTerm)
    );
  }, [clients, clientSearchTerm]);

  // Selected client info
  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Handle template selection
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = DEFAULT_TEMPLATES.find(t => t.id === templateId);
    
    if (template) {
      const templateColumns = AVAILABLE_COLUMNS.filter(col => 
        template.selectedColumns.includes(col.id)
      );
      setSelectedColumns(templateColumns);
      setReportTitle(template.name);
    }
  };

  // Handle column selection
  const handleColumnToggle = (column: ReportColumn, checked: boolean) => {
    if (checked) {
      setSelectedColumns(prev => [...prev, column]);
    } else {
      setSelectedColumns(prev => prev.filter(col => col.id !== column.id));
    }
  };

  // Handle quick column set selection
  const handleQuickColumnSet = (setName: keyof typeof DEFAULT_COLUMN_SETS) => {
    const columnIds = DEFAULT_COLUMN_SETS[setName];
    const columns = AVAILABLE_COLUMNS.filter(col => columnIds.includes(col.id));
    setSelectedColumns(columns);
  };

  // Generate report configuration
  const reportConfiguration: ReportConfiguration = {
    title: reportTitle,
    filters: {
      dateRange,
      clientId: selectedClientId,
      constructionSite: selectedSite !== 'todos' ? selectedSite : undefined,
      recipeCode: selectedRecipe !== 'all' ? selectedRecipe : undefined,
      invoiceRequirement: invoiceRequirement !== 'all' ? 
        invoiceRequirement as 'with_invoice' | 'without_invoice' : undefined,
      singleDateMode
    },
    selectedColumns,
    showSummary,
    showVAT,
    groupBy: 'none',
    sortBy: {
      field: 'fecha',
      direction: 'desc'
    }
  };

  // PDF filename
  const pdfFilename = `reporte-${selectedClient?.business_name?.replace(/[^a-zA-Z0-9]/g, '-') || 'cliente'}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  return (
    <div className="container mx-auto p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Reportes Dinámicos por Cliente
          </CardTitle>
          <CardDescription>
            Genera reportes personalizados de entregas con información detallada para cada cliente
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="filters" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </TabsTrigger>
              <TabsTrigger value="columns" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Columnas
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Vista Previa
              </TabsTrigger>
              <TabsTrigger value="export" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Exportar
              </TabsTrigger>
            </TabsList>

            {/* Filters Tab */}
            <TabsContent value="filters" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Date Range */}
                <div className="space-y-2">
                  <Label>Rango de Fechas</Label>
                  <DateRangePickerWithPresets 
                    dateRange={dateRange} 
                    onDateRangeChange={(range) => range && setDateRange(range)}
                    singleDateMode={singleDateMode}
                    onSingleDateModeChange={setSingleDateMode}
                  />
                </div>

                {/* Client Selection */}
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Popover open={clientComboboxOpen} onOpenChange={setClientComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={clientComboboxOpen}
                        className="w-full justify-between"
                        disabled={loadingClients}
                      >
                        {loadingClients ? (
                          <span className="text-gray-400">Cargando clientes...</span>
                        ) : selectedClient ? (
                          <span className="truncate">{selectedClient.business_name}</span>
                        ) : (
                          <span className="text-gray-400">Seleccionar cliente...</span>
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar cliente..."
                          className="pl-8 h-9 rounded-none border-0 border-b focus-visible:ring-0"
                          value={clientSearchTerm}
                          onChange={(e) => setClientSearchTerm(e.target.value)}
                        />
                      </div>
                                              <Command>
                          <CommandList className="max-h-64 overflow-auto py-2">
                            <CommandEmpty>
                              {loadingClients ? "Cargando clientes..." : 
                               clients.length === 0 ? "No hay clientes con remisiones en este período" :
                               "No se encontraron clientes"}
                              </CommandEmpty>
                            <CommandGroup>
                              {filteredClients.map((client) => (
                                <CommandItem
                                  key={client.id}
                                  value={client.id}
                                  onSelect={() => {
                                    setSelectedClientId(client.id);
                                    setClientComboboxOpen(false);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <div className="flex flex-col">
                                    <span>{client.business_name}</span>
                                    {client.client_code && (
                                      <span className="text-xs text-gray-500">{client.client_code}</span>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                    </PopoverContent>
                  </Popover>
                  
                  {selectedClientId && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-auto p-0"
                      onClick={() => {
                        setSelectedClientId('');
                        setReportData([]);
                        setReportSummary(null);
                      }}
                    >
                      <X className="h-3 w-3 mr-1" /> Limpiar
                    </Button>
                  )}
                </div>

                {/* Construction Site */}
                <div className="space-y-2">
                  <Label>Obra</Label>
                  <Select 
                    value={selectedSite} 
                    onValueChange={setSelectedSite}
                    disabled={!selectedClientId || loadingFilters}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        loadingFilters ? "Cargando obras..." : 
                        !selectedClientId ? "Selecciona un cliente primero" : 
                        "Seleccionar obra..."
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas las Obras</SelectItem>
                      {clientSites.map((site, index) => (
                        <SelectItem key={`site-select-${index}-${site}`} value={site}>
                          {site}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedClientId && clientSites.length === 0 && !loadingFilters && (
                    <p className="text-xs text-gray-500 mt-1">
                      No hay obras con remisiones para este cliente en el período seleccionado
                    </p>
                  )}
                </div>

                {/* Recipe Filter */}
                <div className="space-y-2">
                  <Label>Receta</Label>
                  <Select 
                    value={selectedRecipe} 
                    onValueChange={setSelectedRecipe} 
                    disabled={loadingFilters || !selectedClientId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        !selectedClientId ? "Selecciona un cliente primero" :
                        loadingFilters ? "Cargando recetas..." : 
                        "Todas las recetas..."
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las Recetas</SelectItem>
                      {recipeCodes.map((code, index) => (
                        <SelectItem key={`recipe-select-${index}-${code}`} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedClientId && recipeCodes.length === 0 && !loadingFilters && (
                    <p className="text-xs text-gray-500 mt-1">
                      No hay recetas con remisiones para este cliente en el período seleccionado
                    </p>
                  )}
                </div>

                {/* Invoice Requirement */}
                <div className="space-y-2">
                  <Label>Facturación</Label>
                  <Select value={invoiceRequirement} onValueChange={setInvoiceRequirement}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="with_invoice">Con Factura</SelectItem>
                      <SelectItem value="without_invoice">Sin Factura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={fetchReportData}
                  disabled={!selectedClientId || loading}
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Generar Reporte
                </Button>
              </div>
            </TabsContent>

            {/* Columns Tab */}
            <TabsContent value="columns" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Template Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Plantillas Rápidas</CardTitle>
                    <CardDescription>
                      Selecciona una plantilla predefinida
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {DEFAULT_TEMPLATES.map(template => (
                      <div key={template.id} className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id={template.id}
                          name="template"
                          value={template.id}
                          checked={selectedTemplate === template.id}
                          onChange={() => handleTemplateChange(template.id)}
                          className="h-4 w-4"
                        />
                        <Label htmlFor={template.id} className="flex-1 cursor-pointer">
                          <div>
                            <div className="font-medium">{template.name}</div>
                            <div className="text-sm text-gray-500">{template.description}</div>
                          </div>
                        </Label>
                      </div>
                    ))}

                    <div className="pt-4 border-t space-y-2">
                      <Label className="text-sm font-medium">Conjuntos Rápidos:</Label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(DEFAULT_COLUMN_SETS).map(([setName, _]) => (
                          <Button
                            key={setName}
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickColumnSet(setName as keyof typeof DEFAULT_COLUMN_SETS)}
                          >
                            {setName.charAt(0).toUpperCase() + setName.slice(1)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Column Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Columnas Disponibles</CardTitle>
                    <CardDescription>
                      Selecciona las columnas que deseas incluir en el reporte
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {AVAILABLE_COLUMNS.map(column => {
                        const isSelected = selectedColumns.some(col => col.id === column.id);
                        return (
                          <div key={column.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={column.id}
                              checked={isSelected}
                              onCheckedChange={(checked) => 
                                handleColumnToggle(column, checked === true)
                              }
                            />
                            <Label htmlFor={column.id} className="flex-1 cursor-pointer">
                              <div>
                                <div className="font-medium">{column.label}</div>
                                <div className="text-xs text-gray-500">
                                  {column.type} - {column.width || '10%'}
                                </div>
                              </div>
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Selected Columns Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Columnas Seleccionadas ({selectedColumns.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {selectedColumns.map(column => (
                      <Badge key={column.id} variant="secondary" className="flex items-center gap-1">
                        {column.label}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => handleColumnToggle(column, false)}
                        />
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Report Options */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Opciones del Reporte</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="report-title">Título del Reporte</Label>
                    <Input
                      id="report-title"
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      placeholder="Título del reporte..."
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show-summary"
                      checked={showSummary}
                      onCheckedChange={(checked) => setShowSummary(checked === true)}
                    />
                    <Label htmlFor="show-summary">Incluir resumen general</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show-vat"
                      checked={showVAT}
                      onCheckedChange={(checked) => setShowVAT(checked === true)}
                    />
                    <Label htmlFor="show-vat">Mostrar IVA en cálculos</Label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="space-y-6">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : reportData.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No hay datos para mostrar
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Configura los filtros y genera un reporte para ver la vista previa
                    </p>
                    <Button 
                      onClick={() => setActiveTab('filters')}
                      variant="outline"
                    >
                      Configurar Filtros
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Summary Cards */}
                  {reportSummary && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {reportSummary.totalRemisiones}
                            </div>
                            <div className="text-sm text-gray-500">Total Remisiones</div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {reportSummary.totalVolume.toFixed(2)} m³
                            </div>
                            <div className="text-sm text-gray-500">Volumen Total</div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">
                              {formatCurrency(reportSummary.totalAmount)}
                            </div>
                            <div className="text-sm text-gray-500">Monto Total</div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      {showVAT && (
                        <Card>
                          <CardContent className="p-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-orange-600">
                                {formatCurrency(reportSummary.totalVAT)}
                              </div>
                              <div className="text-sm text-gray-500">IVA Total</div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* Data Preview Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Vista Previa de Datos</span>
                        <Badge variant="outline">
                          {reportData.length} registros
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {selectedColumns.slice(0, 8).map(column => (
                                <TableHead key={column.id}>{column.label}</TableHead>
                              ))}
                              {selectedColumns.length > 8 && (
                                <TableHead>...</TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reportData.slice(0, 10).map((item, index) => (
                              <TableRow key={`preview-${item.id || `index-${index}`}`}>
                                {selectedColumns.slice(0, 8).map(column => {
                                  // Helper function to safely access nested properties
                                  const getValue = (obj: any, path: string): any => {
                                    return path.split('.').reduce((current, key) => current?.[key], obj);
                                  };
                                  
                                  const value = getValue(item, column.field);
                                  let formattedValue = value?.toString() || '-';
                                  
                                  if (column.format === 'currency' && value !== null && value !== undefined) {
                                    formattedValue = formatCurrency(Number(value));
                                  } else if (column.format === 'date' && value) {
                                    try {
                                      formattedValue = format(new Date(value), 'dd/MM/yyyy', { locale: es });
                                    } catch {
                                      formattedValue = value?.toString() || '-';
                                    }
                                  } else if (typeof value === 'boolean') {
                                    formattedValue = value ? 'Sí' : 'No';
                                  }
                                  
                                  return (
                                    <TableCell key={`preview-${item.id || index}-${column.id}`}>{formattedValue}</TableCell>
                                  );
                                })}
                                {selectedColumns.length > 8 && (
                                  <TableCell key={`preview-${item.id || index}-more`}>...</TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      
                      {reportData.length > 10 && (
                        <div className="text-center mt-4 text-sm text-gray-500">
                          Mostrando 10 de {reportData.length} registros. 
                          El reporte completo estará disponible en el PDF.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Export Tab */}
            <TabsContent value="export" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Opciones de Exportación
                  </CardTitle>
                  <CardDescription>
                    Descarga el reporte en formato PDF con la configuración actual
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {reportData.length === 0 ? (
                    <div className="text-center py-8">
                      <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No hay datos para exportar
                      </h3>
                      <p className="text-gray-500 mb-4">
                        Genera un reporte con datos antes de exportar
                      </p>
                      <Button 
                        onClick={() => setActiveTab('filters')}
                        variant="outline"
                      >
                        Configurar Reporte
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Export Summary */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Resumen del Reporte:</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          <li>• Cliente: {selectedClient?.business_name}</li>
                          <li>• Período: {format(dateRange.from!, 'dd/MM/yyyy', { locale: es })} - {format(dateRange.to!, 'dd/MM/yyyy', { locale: es })}</li>
                          <li>• Registros: {reportData.length}</li>
                          <li>• Columnas: {selectedColumns.length}</li>
                          {selectedSite !== 'todos' && <li>• Obra: {selectedSite}</li>}
                          {selectedRecipe !== 'all' && <li>• Receta: {selectedRecipe}</li>}
                        </ul>
                      </div>

                      {/* Download Button */}
                      <div className="flex justify-center">
                        <PDFDownloadLink
                          document={
                            <ClientReportPDF
                              data={reportData}
                              configuration={reportConfiguration}
                              summary={reportSummary!}
                              clientInfo={selectedClient}
                              dateRange={dateRange}
                              generatedAt={new Date()}
                            />
                          }
                          fileName={pdfFilename}
                        >
                          {({ blob, url, loading, error }) => (
                            <Button 
                              size="lg"
                              disabled={loading}
                              className="flex items-center gap-2"
                            >
                              {loading ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                              {loading ? 'Generando PDF...' : 'Descargar PDF'}
                            </Button>
                          )}
                        </PDFDownloadLink>
                      </div>

                      {reportSummary && (
                        <div className="text-center text-sm text-gray-500">
                          El archivo se descargará como: {pdfFilename}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
