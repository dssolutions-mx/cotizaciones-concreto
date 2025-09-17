'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from "react-day-picker";
import { PDFDownloadLink } from '@react-pdf/renderer';

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

// Icons
import { 
  Download, 
  FileText, 
  Settings, 
  Eye, 
  Search, 
  Filter,
  BarChart3,
  FileSpreadsheet,
  Target,
  X
} from 'lucide-react';

// Services and Types
import { ReportDataService } from '@/services/reportDataService';
import type { 
  ReportFilter, 
  ReportConfiguration, 
  ReportRemisionData, 
  ReportSummary,
  ReportColumn,
  HierarchicalReportData,
  SelectionSummary
} from '@/types/pdf-reports';
import { 
  AVAILABLE_COLUMNS, 
  DEFAULT_COLUMN_SETS, 
  DEFAULT_TEMPLATES 
} from '@/types/pdf-reports';

// Components
import ClientReportPDF from '@/components/reports/ClientReportPDF';
import EnhancedReportFilters from '@/components/reports/EnhancedReportFilters';
import { formatCurrency } from '@/lib/utils';

export default function ReportesClientes() {
  // Enhanced state for new hierarchical system
  const [hierarchicalData, setHierarchicalData] = useState<HierarchicalReportData | null>(null);
  const [selectionSummary, setSelectionSummary] = useState<SelectionSummary>({
    totalClients: 0,
    totalOrders: 0,
    totalRemisiones: 0,
    totalVolume: 0,
    totalAmount: 0,
    selectedClients: [],
    selectedOrders: [],
    selectedRemisiones: []
  });
  const [currentFilters, setCurrentFilters] = useState<ReportFilter>({
    dateRange: { from: subDays(new Date(), 30), to: new Date() },
    clientIds: [],
    orderIds: [],
    remisionIds: []
  });

  // State for legacy report data (for PDF generation)
  const [reportData, setReportData] = useState<ReportRemisionData[]>([]);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  
  // State for UI
  const [loading, setLoading] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  
  // State for report configuration
  const [selectedColumns, setSelectedColumns] = useState<ReportColumn[]>(
    AVAILABLE_COLUMNS.filter(col => DEFAULT_COLUMN_SETS.company_standard.includes(col.id))
  );
  const [selectedTemplate, setSelectedTemplate] = useState<string>('company-standard');
  const [reportTitle, setReportTitle] = useState<string>('Reporte Dinámico de Entregas');
  const [showSummary, setShowSummary] = useState<boolean>(true);
  const [showVAT, setShowVAT] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('selection');

  // Handle data changes from enhanced filters
  const handleDataChange = useCallback((data: HierarchicalReportData, filters: ReportFilter) => {
    setHierarchicalData(data);
    setCurrentFilters(filters);
  }, []);

  // Handle selection changes
  const handleSelectionChange = useCallback((summary: SelectionSummary) => {
    setSelectionSummary(summary);
  }, []);

  // Generate actual report data for PDF
  const generateReportData = useCallback(async () => {
    if (!currentFilters.dateRange.from || !currentFilters.dateRange.to) {
      alert('Por favor selecciona un rango de fechas válido');
      return;
    }
    
    if (selectionSummary.selectedRemisiones.length === 0) {
      alert('Por favor selecciona al menos una remisión para el reporte');
      return;
    }

    // No exigir cliente si ya hay órdenes o remisiones seleccionadas

    setGeneratingReport(true);
    try {
      // Ensure clientIds are properly set from selection summary
      const filtersWithClients = {
        ...currentFilters,
        clientIds: selectionSummary.selectedClients,
        orderIds: selectionSummary.selectedOrders,
        remisionIds: selectionSummary.selectedRemisiones
      };
      
      const result = await ReportDataService.fetchReportData(filtersWithClients);
      setReportData(result.data);
      setReportSummary(result.summary);
      
      // Switch to preview tab
      setActiveTab('preview');
    } catch (error) {
      console.error('Error generating report data:', error);
      alert('Error al generar los datos del reporte');
    } finally {
      setGeneratingReport(false);
    }
  }, [currentFilters, selectionSummary]);

  // Clear report data when selection changes
  useEffect(() => {
    if (selectionSummary.selectedRemisiones.length === 0) {
      setReportData([]);
      setReportSummary(null);
    }
  }, [selectionSummary.selectedRemisiones]);

  // Get selected client info from hierarchical data
  const selectedClient = useMemo(() => {
    if (!hierarchicalData || selectionSummary.selectedClients.length !== 1) return null;
    return hierarchicalData.clients.find(c => c.id === selectionSummary.selectedClients[0]);
  }, [hierarchicalData, selectionSummary.selectedClients]);

  // Extract plant information from report data for VAT calculation
  const plantInfo = useMemo(() => {
    if (!reportData || reportData.length === 0) return null;
    
    // Get unique plants from the data
    const plants = Array.from(new Set(
      reportData
        .map(item => item.plant_info)
        .filter(Boolean)
    ));
    
    if (plants.length === 0) return null;
    
    // If all plants have the same VAT rate, use that
    const vatRates = plants.map(p => p?.vat_percentage).filter((rate): rate is number => rate !== undefined);
    const uniqueVatRates = Array.from(new Set(vatRates));
    
    if (uniqueVatRates.length === 1) {
      // Single VAT rate across all plants
      const plant = plants[0];
      return {
        plant_id: plant?.plant_id || '',
        plant_code: plant?.plant_code || '',
        plant_name: plant?.plant_name || '',
        vat_percentage: uniqueVatRates[0]
      };
    } else {
      // Multiple VAT rates - use the most common one or default
      const vatCounts: Record<number, number> = {};
      vatRates.forEach(rate => {
        vatCounts[rate] = (vatCounts[rate] || 0) + 1;
      });
      
      const mostCommonVat = Object.entries(vatCounts)
        .sort(([,a], [,b]) => b - a)[0][0];
      
      const representativePlant = plants.find(p => p?.vat_percentage === Number(mostCommonVat));
      
      return {
        plant_id: representativePlant?.plant_id || '',
        plant_code: representativePlant?.plant_code || '',
        plant_name: representativePlant?.plant_name || '',
        vat_percentage: Number(mostCommonVat)
      };
    }
  }, [reportData]);

  // Enhanced client info with plant information
  const enhancedClientInfo = useMemo(() => {
    if (!selectedClient) return undefined;
    
    return {
      business_name: selectedClient.business_name,
      name: selectedClient.business_name,
      address: '', // We don't have address in SelectableClient
      rfc: selectedClient.rfc,
      plant_info: plantInfo || undefined
    };
  }, [selectedClient, plantInfo]);

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
    filters: currentFilters,
    selectedColumns,
    showSummary,
    showVAT,
    groupBy: 'none',
    sortBy: {
      field: 'fecha',
      direction: 'desc'
    },
    selectionMode: 'remision-level',
    allowPartialSelection: true
  };

  // PDF filename
  const pdfFilename = `reporte-${selectedClient?.business_name?.replace(/[^a-zA-Z0-9]/g, '-') || 'dinamico'}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  return (
    <div className="container mx-auto p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Reportes Dinámicos Avanzados
          </CardTitle>
          <CardDescription>
            Sistema avanzado de generación de reportes con selección jerárquica flexible por cliente, orden y remisión
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="selection" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Selección
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

            {/* Enhanced Selection Tab */}
            <TabsContent value="selection" className="space-y-6">
              <EnhancedReportFilters
                onDataChange={handleDataChange}
                onSelectionChange={handleSelectionChange}
                loading={loading}
              />
              
              {selectionSummary.selectedRemisiones.length > 0 && (
                <div className="flex justify-center">
                  <Button 
                    onClick={generateReportData}
                    disabled={generatingReport}
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    {generatingReport ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <BarChart3 className="h-4 w-4" />
                    )}
                    {generatingReport ? 'Generando Reporte...' : 'Generar Reporte para PDF'}
                  </Button>
                </div>
              )}
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
              {loading || generatingReport ? (
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
                      {selectionSummary.selectedRemisiones.length === 0 
                        ? 'Selecciona remisiones en la pestaña de Selección'
                        : 'Haz clic en "Generar Reporte para PDF" para procesar los datos'
                      }
                    </p>
                    <Button 
                      onClick={() => setActiveTab(selectionSummary.selectedRemisiones.length === 0 ? 'selection' : 'selection')}
                      variant="outline"
                    >
                      {selectionSummary.selectedRemisiones.length === 0 ? 'Ir a Selección' : 'Generar Datos'}
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
                                {formatCurrency((reportSummary.totalAmount * (plantInfo?.vat_percentage || 0.16)))}
                              </div>
                              <div className="text-sm text-gray-500">
                                IVA Total ({((plantInfo?.vat_percentage || 0.16) * 100).toFixed(0)}%)
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      {showVAT && (
                        <Card>
                          <CardContent className="p-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-red-600">
                                {formatCurrency(reportSummary.totalAmount + ((reportSummary.totalAmount * (plantInfo?.vat_percentage || 0.16))))}
                              </div>
                              <div className="text-sm text-gray-500">Total Final</div>
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
                        {selectionSummary.selectedRemisiones.length === 0
                          ? 'Selecciona remisiones para generar el reporte'
                          : 'Genera los datos del reporte antes de exportar'
                        }
                      </p>
                      <Button 
                        onClick={() => setActiveTab('selection')}
                        variant="outline"
                      >
                        {selectionSummary.selectedRemisiones.length === 0 ? 'Seleccionar Datos' : 'Generar Reporte'}
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Export Summary */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Resumen del Reporte:</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          <li>• Clientes seleccionados: {selectionSummary.selectedClients.length}</li>
                          <li>• Órdenes seleccionadas: {selectionSummary.selectedOrders.length}</li>
                          <li>• Remisiones seleccionadas: {selectionSummary.selectedRemisiones.length}</li>
                          <li>• Período: {format(currentFilters.dateRange.from!, 'dd/MM/yyyy', { locale: es })} - {format(currentFilters.dateRange.to!, 'dd/MM/yyyy', { locale: es })}</li>
                          <li>• Registros en PDF: {reportData.length}</li>
                          <li>• Columnas: {selectedColumns.length}</li>
                          {currentFilters.recipeCodes && currentFilters.recipeCodes.length > 0 && (
                            <li>• Recetas filtradas: {currentFilters.recipeCodes.length}</li>
                          )}
                          {currentFilters.constructionSites && currentFilters.constructionSites.length > 0 && (
                            <li>• Obras filtradas: {currentFilters.constructionSites.length}</li>
                          )}
                          {plantInfo && <li>• Planta: {plantInfo.plant_name} ({plantInfo.plant_code})</li>}
                          {showVAT && <li>• IVA: {((plantInfo?.vat_percentage || 0.16) * 100).toFixed(0)}%</li>}
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
                              clientInfo={enhancedClientInfo}
                              dateRange={currentFilters.dateRange}
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