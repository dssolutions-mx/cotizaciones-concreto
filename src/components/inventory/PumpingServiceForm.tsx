'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '../ui/label';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/lib/utils/toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Search, Calendar, Truck, User, Package, MapPin, Check, Info, FileText, Upload, RefreshCw } from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';
import { RemisionPendingFile, RemisionDocument } from '@/types/remisiones';
import SimpleFileUpload from '@/components/inventory/SimpleFileUpload';
import { format } from 'date-fns';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { fetchApprovedPumpUnitPrice } from '@/lib/pumpPricing';
import { recalculateOrderAmount } from '@/services/orderService';
import {
  REMISION_DOCUMENT_MAX_MB,
  messageForRemisionDocumentUploadFailure,
} from '@/lib/constants/remisionDocumentsUpload';
import { uploadRemisionDocumentFromClient } from '@/lib/remisiones/uploadRemisionDocumentFromClient';

// Plant interface for the form
interface Plant {
  id: string;
  name: string;
}

// Remision interface for search
interface RemisionOption {
  id: string;
  remision_number: string;
  tipo_remision: 'CONCRETO' | 'BOMBEO';
  fecha: string;
  order_id: string;
  order_number: string;
  client_name: string;
}

// Order interface with full information
interface OrderWithRemisiones {
  id: string;
  order_number: string;
  delivery_date: string;
  order_status: string;
  construction_site: string;
  elemento?: string;
  total_amount: number;
  client_id: string;
  clients: {
    business_name: string;
  };
  remisiones: Array<{
    id: string;
    remision_number: string;
    tipo_remision: 'CONCRETO' | 'BOMBEO';
    volumen_fabricado: number;
    fecha: string;
    hora_carga: string;
  }>;
  order_items: Array<{
    id: string;
    product_type: string;
    volume: number;
    unit_price?: number | null;
    pump_price?: number | null;
    has_pump_service: boolean;
    concrete_volume_delivered: number;
    pump_volume_delivered: number;
  }>;
}

export default function PumpingServiceForm() {
  const { profile } = useAuthBridge();
  const { availablePlants, currentPlant, isLoading: plantContextLoading } = usePlantContext();
  const [formData, setFormData] = useState({
    remisionNumber: '',
    fecha: new Date().toISOString().split('T')[0],
    horaCarga: new Date().toTimeString().split(' ')[0].substring(0, 5), // HH:MM format
    volumen: '',
    conductor: '',
    unidad: '',
    plantId: '',
    filterDate: new Date().toISOString().split('T')[0], // Default to today for filtering
  });

  const [loading, setLoading] = useState(false);
  const [remisionOptions, setRemisionOptions] = useState<RemisionOption[]>([]);
  const [filteredRemisions, setFilteredRemisions] = useState<RemisionOption[]>([]);
  const [selectedRemision, setSelectedRemision] = useState<RemisionOption | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithRemisiones | null>(null);
  const [remisionSearchOpen, setRemisionSearchOpen] = useState(false);
  const [remisionSearchTerm, setRemisionSearchTerm] = useState('');
  const [loadingRemisions, setLoadingRemisions] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [activeTab, setActiveTab] = useState<'select-remision' | 'create-remision'>('select-remision');

  // Attachment state
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<RemisionPendingFile[]>([]);
  const [existingDocuments, setExistingDocuments] = useState<RemisionDocument[]>([]);
  /** When evidence upload fails after remision insert, retry uploads against this id (no duplicate remision). */
  const [evidenceRetryRemisionId, setEvidenceRetryRemisionId] = useState<string | null>(null);
  
  // Signed URL management (Supabase best practice)
  const { getSignedUrl, isLoading: urlLoading, getCachedUrl } = useSignedUrls('remision-documents', 3600);

  // Set up plants from PlantContext and auto-select plant
  useEffect(() => {
    if (!plantContextLoading && availablePlants.length > 0) {
      // Auto-select the current plant if available, otherwise first available plant
      const plantToSelect = currentPlant || availablePlants[0];
      if (plantToSelect) {
        setFormData(prev => ({ ...prev, plantId: plantToSelect.id }));
      }
    }
  }, [availablePlants, currentPlant, plantContextLoading]);

  // Fetch remision options when plant and filter date are selected
  useEffect(() => {
    const fetchRemisions = async () => {
      if (!formData.plantId || !formData.filterDate) return;

      setLoadingRemisions(true);
      try {
        // Use exact date match - no need for date range calculation
        const { data, error } = await supabase
          .from('remisiones')
          .select(`
            id,
            remision_number,
            tipo_remision,
            fecha,
            order_id,
            orders!inner(
              order_number,
              clients(business_name)
            )
          `)
          .eq('tipo_remision', 'CONCRETO') // Only show concrete remisions that can have pumping services
          .eq('plant_id', formData.plantId) // Filter by selected plant
          .eq('fecha', formData.filterDate) // Exact date match
          .order('fecha', { ascending: false })
          .limit(200);

        if (error) throw error;

        const remisionData = (data || []).map(item => ({
          id: item.id,
          remision_number: item.remision_number,
          tipo_remision: item.tipo_remision,
          fecha: item.fecha,
          order_id: item.order_id,
          order_number: item.orders?.order_number || '',
          client_name: item.orders?.clients?.business_name || ''
        }));

        setRemisionOptions(remisionData);
        setFilteredRemisions(remisionData);
      } catch (error: any) {
        console.error('Error fetching remisions:', error);
        showError('Error al cargar las remisiones: ' + error.message);
      } finally {
        setLoadingRemisions(false);
      }
    };

    fetchRemisions();
  }, [formData.plantId, formData.filterDate]);

  // Filter remisions based on search term
  useEffect(() => {
    if (!remisionSearchTerm) {
      setFilteredRemisions(remisionOptions);
    } else {
      const filtered = remisionOptions.filter(remision =>
        remision.remision_number.toLowerCase().includes(remisionSearchTerm.toLowerCase()) ||
        remision.order_number.toLowerCase().includes(remisionSearchTerm.toLowerCase()) ||
        remision.client_name.toLowerCase().includes(remisionSearchTerm.toLowerCase())
      );
      setFilteredRemisions(filtered);
    }
  }, [remisionOptions, remisionSearchTerm]);

  // Fetch order details when remision is selected
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!selectedRemision) return;

      setLoadingOrder(true);
      try {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            delivery_date,
            order_status,
            construction_site,
            elemento,
            total_amount,
            client_id,
            clients!inner(business_name),
            remisiones(
              id,
              remision_number,
              tipo_remision,
              volumen_fabricado,
              fecha,
              hora_carga
            ),
            order_items(
              id,
              product_type,
              volume,
              unit_price,
              pump_price,
              has_pump_service,
              concrete_volume_delivered,
              pump_volume_delivered
            )
          `)
          .eq('id', selectedRemision.order_id)
          .single();

        if (error) throw error;

        setSelectedOrder(data);
        setActiveTab('create-remision');
      } catch (error: any) {
        console.error('Error fetching order details:', error);
        showError('Error al cargar los detalles de la orden: ' + error.message);
      } finally {
        setLoadingOrder(false);
      }
    };

    fetchOrderDetails();
  }, [selectedRemision]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePlantChange = (value: string) => {
    setFormData(prev => ({ ...prev, plantId: value }));
    setSelectedRemision(null); // Clear selected remision when plant changes
    setSelectedOrder(null); // Clear selected order when plant changes
    setRemisionOptions([]); // Clear remisions when plant changes
    setFilteredRemisions([]);
    setActiveTab('select-remision');
  };

  const handleFilterDateChange = (value: string) => {
    setFormData(prev => ({ ...prev, filterDate: value }));
    setSelectedRemision(null); // Clear selected remision when date changes
    setSelectedOrder(null); // Clear selected order when date changes
    setActiveTab('select-remision');
  };

  const handleRemisionSelect = (remision: RemisionOption) => {
    setSelectedRemision(remision);
    setFormData((prev) => ({
      ...prev,
      remisionNumber: '',
      fecha: remision.fecha,
    }));
    setRemisionSearchOpen(false);
  };

  const handleBackToRemisions = () => {
    setEvidenceRetryRemisionId(null);
    setPendingFiles([]);
    setExistingDocuments([]);
    setSelectedRemision(null);
    setSelectedOrder(null);
    // Reset the form data when going back
    setFormData(prev => ({
      ...prev,
      remisionNumber: '',
      fecha: new Date().toISOString().split('T')[0],
      horaCarga: new Date().toTimeString().split(' ')[0].substring(0, 5),
      volumen: '',
      conductor: '',
      unidad: ''
    }));
    setActiveTab('select-remision');
  };

  // File handling functions
  const handleFileUpload = (files: FileList) => {
    const newFiles = Array.from(files).map(file => ({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending' as const
    }));
    
    setPendingFiles(prev => [...prev, ...newFiles]);
  };

  // Remove pending file
  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  type EvidenceUploadBatchResult = {
    allSucceeded: boolean;
    attempted: number;
    successCount: number;
    failCount: number;
    errors: string[];
  };

  /** Upload pending (or failed) evidence files for a remision. Skips entries already `uploaded`. */
  const uploadDocuments = async (remisionId: string): Promise<EvidenceUploadBatchResult> => {
    const initial = pendingFiles;
    const attempted = initial.filter((f) => f.status !== 'uploaded').length;

    setUploading(true);
    try {
      let plantId = formData.plantId;
      if (!plantId) {
        const { data: remRow } = await supabase
          .from('remisiones')
          .select('plant_id')
          .eq('id', remisionId)
          .single();
        plantId = remRow?.plant_id ?? '';
      }
      if (!plantId) {
        const err = 'No se pudo determinar la planta para subir la evidencia.';
        setPendingFiles((prev) =>
          prev.map((f) =>
            f.status === 'uploaded' ? f : { ...f, status: 'error' as const, error: err }
          )
        );
        return {
          allSucceeded: false,
          attempted,
          successCount: 0,
          failCount: attempted,
          errors: [err],
        };
      }

      const uploadPromises = initial.map(async (fileInfo) => {
        if (fileInfo.status === 'uploaded') {
          return fileInfo;
        }
        try {
          const result = await uploadRemisionDocumentFromClient({
            remisionId,
            plantId,
            file: fileInfo.file,
            documentType: 'remision_proof',
            documentCategory: 'pumping_remision',
          });
          return { ...fileInfo, status: 'uploaded' as const, documentId: result.id };
        } catch (error) {
          console.error('Error uploading document:', error);
          const message =
            error instanceof Error
              ? error.message
              : messageForRemisionDocumentUploadFailure(0);
          return { ...fileInfo, status: 'error' as const, error: message };
        }
      });

      const results = await Promise.all(uploadPromises);
      setPendingFiles(results);

      let batchOk = 0;
      let batchFail = 0;
      for (let i = 0; i < initial.length; i++) {
        if (initial[i].status === 'uploaded') continue;
        if (results[i].status === 'uploaded') batchOk++;
        else batchFail++;
      }

      const errors = results
        .filter((f): f is RemisionPendingFile & { status: 'error' } => f.status === 'error')
        .map((f) => f.error || 'Error desconocido');

      if (batchOk > 0) {
        await fetchExistingDocuments(remisionId);
      }

      return {
        allSucceeded: attempted === 0 || batchFail === 0,
        attempted,
        successCount: batchOk,
        failCount: batchFail,
        errors,
      };
    } finally {
      setUploading(false);
    }
  };

  // Fetch existing documents for a remision
  const fetchExistingDocuments = async (remisionId: string) => {
    try {
      const response = await fetch(`/api/remisiones/documents?remision_id=${remisionId}&document_category=pumping_remision`);
      if (response.ok) {
        const data = await response.json();
        // Store documents without URLs - we'll generate signed URLs on-demand
        const documents = (data.data || []).map((doc: RemisionDocument) => ({
          ...doc,
          url: null // We'll generate these on-demand for security
        }));
        setExistingDocuments(documents);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  // Delete existing document
  const deleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/remisiones/documents?id=${documentId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setExistingDocuments(prev => prev.filter(doc => doc.id !== documentId));
        showSuccess('Documento eliminado correctamente');
      } else {
        const error = await response.json();
        showError(`Error al eliminar documento: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      showError('Error al eliminar documento');
    }
  };

  // Handle document viewing with on-demand signed URL generation (Supabase best practice)
  const handleViewDocument = async (doc: RemisionDocument) => {
    try {
      // Check if we have a cached URL first
      const cachedUrl = getCachedUrl(doc.file_path);
      if (cachedUrl) {
        window.open(cachedUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      // Generate fresh signed URL
      const signedUrl = await getSignedUrl(doc.file_path);
      if (signedUrl) {
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        showError('No se pudo generar enlace para ver el documento');
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      showError('Error al abrir el documento');
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'created': return 'bg-blue-100 text-blue-800';
      case 'validated': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getOrderStatusText = (status: string) => {
    switch (status) {
      case 'created': return 'Creada';
      case 'validated': return 'Validada';
      case 'scheduled': return 'Programada';
      case 'in_progress': return 'En Progreso';
      default: return status;
    }
  };

  const handleRetryEvidenceUpload = async () => {
    if (!evidenceRetryRemisionId) return;
    try {
      setLoading(true);
      const r = await uploadDocuments(evidenceRetryRemisionId);
      if (r.attempted > 0 && r.failCount > 0) {
        showError(r.errors[0] ?? `No se pudieron subir ${r.failCount} archivo(s).`);
        return;
      }
      showSuccess(
        r.successCount > 0
          ? `${r.successCount} archivo(s) de evidencia guardado(s) correctamente.`
          : 'Evidencia actualizada correctamente.'
      );
      setEvidenceRetryRemisionId(null);
      setFormData((prev) => ({
        ...prev,
        remisionNumber: '',
        fecha: new Date().toISOString().split('T')[0],
        horaCarga: new Date().toTimeString().split(' ')[0].substring(0, 5),
        volumen: '',
        conductor: '',
        unidad: '',
      }));
      setPendingFiles([]);
      setExistingDocuments([]);
      setSelectedRemision(null);
      setSelectedOrder(null);
      setActiveTab('select-remision');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedOrder || !selectedRemision) {
      showError('Debe seleccionar una remisión primero');
      return;
    }

    const pumpingRemisionNumber = formData.remisionNumber.trim();
    if (!pumpingRemisionNumber || !formData.fecha || !formData.horaCarga || !formData.volumen) {
      showError(
        'Por favor, completa todos los campos obligatorios (Nº remisión de bombeo, Fecha, Hora de Carga, Volumen)'
      );
      return;
    }

    try {
      setLoading(true);

      const volumen = parseFloat(formData.volumen) || 0;

      const unitPrice = await fetchApprovedPumpUnitPrice(
        supabase,
        selectedOrder.client_id,
        selectedOrder.construction_site
      );

      // 1. Check if there's already a pumping service item in the order, if not, create one
      let pumpServiceItem = selectedOrder.order_items.find(item =>
        item.product_type === 'SERVICIO DE BOMBEO'
      );

      if (!pumpServiceItem) {
        const totalPrice = unitPrice * volumen;
        const orderItemPayload = {
          order_id: selectedOrder.id,
          product_type: 'SERVICIO DE BOMBEO',
          volume: volumen,
          unit_price: unitPrice,
          total_price: totalPrice,
          has_pump_service: true,
          pump_price: unitPrice,
          pump_volume: volumen,
        };

        const { data: newItem, error: orderItemError } = await supabase
          .from('order_items')
          .insert(orderItemPayload)
          .select()
          .single();

        if (orderItemError) throw orderItemError;
        pumpServiceItem = newItem;
      } else {
        const priceMissing =
          pumpServiceItem.pump_price == null ||
          Number(pumpServiceItem.pump_price) === 0;
        if (priceMissing && unitPrice > 0) {
          const vol = pumpServiceItem.volume ?? volumen;
          const { error: updatePriceError } = await supabase
            .from('order_items')
            .update({
              unit_price: unitPrice,
              pump_price: unitPrice,
              total_price: unitPrice * vol,
            })
            .eq('id', pumpServiceItem.id);

          if (updatePriceError) throw updatePriceError;
        }
      }

      // 2. Prepare the payload for the pumping service remision
      const remisionPayload: any = {
        order_id: selectedOrder.id, // Use the selected order
        remision_number: pumpingRemisionNumber,
        fecha: formData.fecha,
        hora_carga: formData.horaCarga + ':00', // Add seconds to match database format
        volumen_fabricado: volumen,
        conductor: formData.conductor || null,
        unidad: formData.unidad || null,
        tipo_remision: 'BOMBEO', // Always BOMBEO for this form
        plant_id: formData.plantId,
        recipe_id: null, // No recipe for pumping service
        designacion_ehe: null, // No recipe designation
      };

      // Add created_by if user is available
      if (profile?.id) {
        remisionPayload.created_by = profile.id;
      }

      // 3. Insert the main remision record
      const { data: remisionData, error: remisionError } = await supabase
        .from('remisiones')
        .insert(remisionPayload)
        .select('id')
        .single();

      if (remisionError) throw remisionError;

      try {
        await recalculateOrderAmount(selectedOrder.id);
      } catch (recalcErr) {
        console.error('recalculateOrderAmount after bombeo remisión:', recalcErr);
      }

      const newRemisionId = remisionData.id;
      const uploadResult = await uploadDocuments(newRemisionId);

      if (uploadResult.attempted > 0 && uploadResult.failCount > 0) {
        setEvidenceRetryRemisionId(newRemisionId);
        showError(
          uploadResult.errors[0] ??
            `No se pudieron subir ${uploadResult.failCount} archivo(s). La remisión ya fue registrada. Use «Reintentar evidencia» o corrija los archivos.`
        );
        return;
      }

      setEvidenceRetryRemisionId(null);

      if (uploadResult.successCount > 0) {
        showSuccess(
          `Remisión de bombeo registrada correctamente. ${uploadResult.successCount} archivo(s) de evidencia guardado(s).`
        );
      } else {
        showSuccess('Remisión de bombeo registrada correctamente.');
      }

      // Resetear formulario pero mantener filtros de búsqueda
      setFormData(prev => ({
        ...prev,
        remisionNumber: '',
        fecha: new Date().toISOString().split('T')[0],
        horaCarga: new Date().toTimeString().split(' ')[0].substring(0, 5),
        volumen: '',
        conductor: '',
        unidad: '',
      }));

      setPendingFiles([]);
      setExistingDocuments([]);
      setSelectedRemision(null);
      setSelectedOrder(null);
      setActiveTab('select-remision');

    } catch (error: any) {
      console.error('Error al guardar remisión de bombeo:', error);
      showError(error.message || 'Error al registrar la remisión de bombeo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="select-remision">Seleccionar Remisión</TabsTrigger>
          <TabsTrigger value="create-remision" disabled={!selectedOrder}>
            Crear Remisión de Bombeo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="select-remision" className="space-y-6">
          {/* Plant Selection and Date Filter */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="plantId">Planta *</Label>
              <Select
                value={formData.plantId}
                onValueChange={handlePlantChange}
                disabled={plantContextLoading}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={plantContextLoading ? "Cargando plantas..." : "Seleccione una planta"} />
                </SelectTrigger>
                <SelectContent>
                  {availablePlants.map((plant) => (
                    <SelectItem key={plant.id} value={plant.id}>
                      {plant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Filter */}
            <div>
              <Label htmlFor="filterDate">Fecha de Remisión</Label>
              <Input
                id="filterDate"
                name="filterDate"
                type="date"
                value={formData.filterDate}
                onChange={(e) => handleFilterDateChange(e.target.value)}
                className="mt-1"
                disabled={!formData.plantId}
              />
              <p className="text-xs text-gray-500 mt-1">
                Muestra remisiones del día seleccionado
              </p>
            </div>

            {/* Remision Search */}
            <div>
              <Label>Buscar Remisión</Label>
              <Popover open={remisionSearchOpen} onOpenChange={setRemisionSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={remisionSearchOpen}
                    className="w-full justify-between mt-1"
                    disabled={loadingRemisions || !formData.plantId || !formData.filterDate}
                  >
                    {selectedRemision
                      ? `${selectedRemision.remision_number} - ${selectedRemision.client_name}`
                      : "Buscar remisión..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar por número de remisión, orden o cliente..."
                      value={remisionSearchTerm}
                      onValueChange={setRemisionSearchTerm}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {loadingRemisions ? "Cargando remisiones..." : "No se encontraron remisiones."}
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredRemisions.map((remision) => (
                          <CommandItem
                            key={remision.id}
                            value={`${remision.remision_number} ${remision.order_number} ${remision.client_name}`}
                            onSelect={() => handleRemisionSelect(remision)}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedRemision?.id === remision.id ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <Truck className="h-3 w-3" />
                                <span className="font-medium">{remision.remision_number}</span>
                                <Badge variant="outline" className="text-xs">
                                  {remision.tipo_remision}
                                </Badge>
                              </div>
                              <div className="text-xs text-gray-500">
                                Orden: {remision.order_number} • Cliente: {remision.client_name}
                              </div>
                              <div className="text-xs text-gray-400">
                                {remision.fecha}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Filter Summary */}
          {formData.plantId && formData.filterDate && (
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-600" />
                      <span className="text-gray-700">
                        Remisiones del {formData.filterDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-gray-600" />
                      <span className="text-gray-700">
                        {loadingRemisions ? 'Cargando...' : `${remisionOptions.length} remisiones encontradas`}
                      </span>
                    </div>
                  </div>
                  {formData.filterDate !== new Date().toISOString().split('T')[0] && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFilterDateChange(new Date().toISOString().split('T')[0])}
                      className="text-xs"
                    >
                      Hoy
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selected Remision Info */}
          {selectedRemision && (
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5 text-green-600" />
                  Remisión Seleccionada: {selectedRemision.remision_number}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-green-600" />
                    <span>{selectedRemision.client_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-green-600" />
                    <span>Orden: {selectedRemision.order_number}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-green-600" />
                    <span>{selectedRemision.fecha}</span>
                  </div>
                </div>
                <div className="mt-4">
                  {loadingOrder ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
                      <p className="text-sm text-gray-600 mt-2">Cargando detalles de la orden...</p>
                    </div>
                  ) : selectedOrder ? (
                    <div className="bg-white rounded-lg p-4 border">
                      <h4 className="font-medium mb-2">Información de la Orden:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong>Cliente:</strong> {selectedOrder.clients.business_name}
                        </div>
                        <div>
                          <strong>Obra:</strong> {selectedOrder.construction_site}
                        </div>
                        <div>
                          <strong>Fecha de entrega:</strong> {selectedOrder.delivery_date}
                        </div>
                        {selectedOrder.elemento && (
                          <div>
                            <strong>Elemento:</strong> {selectedOrder.elemento}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">Cargando información de la orden...</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!formData.plantId && (
            <div className="text-center py-8 text-gray-500">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Seleccione una planta</h3>
                  <p className="text-sm text-gray-600">
                    Elija una planta y fecha para buscar remisiones de concreto disponibles para bombeo
                  </p>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="create-remision" className="space-y-6">
          {selectedOrder && selectedRemision && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Order and Remision Summary */}
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Orden: {selectedOrder.order_number} • Remisión: {selectedRemision.remision_number}</span>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBackToRemisions}
                      className="text-sm"
                    >
                      Cambiar Remisión
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600" />
                      <span>{selectedOrder.clients.business_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span>{selectedOrder.delivery_date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      <span>{selectedOrder.construction_site}</span>
                    </div>
                  </div>
                  {selectedOrder.elemento && (
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span>Elemento: {selectedOrder.elemento}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Número de remisión de bombeo</AlertTitle>
                <AlertDescription className="text-sm">
                  Antes este campo se llenaba solo con el número de la remisión de concreto. Ahora debe
                  escribirse el número que viene en la{' '}
                  <strong>remisión o ticket físico del servicio de bombeo</strong> (no el de concreto).
                  La remisión de concreto que eligió arriba solo ayuda a enlazar el pedido.
                </AlertDescription>
              </Alert>

              {/* Remision Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Remision Number */}
                <div>
                  <Label htmlFor="remisionNumber" className="mb-1">
                    Número de remisión de bombeo *
                  </Label>
                  <Input
                    id="remisionNumber"
                    name="remisionNumber"
                    value={formData.remisionNumber}
                    onChange={handleInputChange}
                    required
                    autoComplete="off"
                    placeholder="Tal como aparece en la remisión de bombeo"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Use exactamente el folio de la remisión de bombeo. No use el número de remisión de
                    concreto salvo que en el papel sea el mismo.
                  </p>
                </div>

                {/* Fecha */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Label htmlFor="fecha">Fecha *</Label>
                    <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      <Info className="h-3 w-3" />
                      Prefilled
                    </div>
                  </div>
                  <Input
                    id="fecha"
                    name="fecha"
                    type="date"
                    value={formData.fecha}
                    onChange={handleInputChange}
                    required
                    className="bg-blue-50 border-blue-200"
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    Fecha de la remisión original (puede modificarse)
                  </p>
                </div>

                {/* Hora de Carga */}
                <div>
                  <Label htmlFor="horaCarga">Hora de Carga *</Label>
                  <Input
                    id="horaCarga"
                    name="horaCarga"
                    type="time"
                    value={formData.horaCarga}
                    onChange={handleInputChange}
                    required
                    className="mt-1"
                  />
                </div>

                {/* Volumen */}
                <div>
                  <Label htmlFor="volumen">Volumen (m³) *</Label>
                  <Input
                    id="volumen"
                    name="volumen"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.volumen}
                    onChange={handleInputChange}
                    required
                    className="mt-1"
                  />
                </div>

                {/* Conductor */}
                <div>
                  <Label htmlFor="conductor">Conductor</Label>
                  <Input
                    id="conductor"
                    name="conductor"
                    value={formData.conductor}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>

                {/* Unidad (Matricula) */}
                <div>
                  <Label htmlFor="unidad">Unidad (Matrícula)</Label>
                  <Input
                    id="unidad"
                    name="unidad"
                    value={formData.unidad}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Service Type Indicator */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="font-medium text-blue-800">Tipo de Servicio: Bombeo</span>
                </div>
                <div className="text-sm text-blue-600 mt-1 space-y-1">
                  <p>
                    <strong>Remisión de concreto (referencia):</strong> {selectedRemision.remision_number}
                  </p>
                  <p>
                    <strong>Orden:</strong> {selectedOrder.order_number}
                  </p>
                  <p>
                    <strong>Remisión de bombeo (registrada):</strong>{' '}
                    {formData.remisionNumber.trim() || '—'}
                  </p>
                  <p className="text-xs text-gray-500 italic mt-2">
                    Debe reflejar el ticket de bombeo. Ya no se copia el de concreto: si difieren,
                    registre el de bombeo.
                  </p>
                </div>
              </div>

              {/* Attachment Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Evidencia de la Remisión
                  </CardTitle>
                  <CardDescription>
                    Adjunte documentos de evidencia de la entrega del servicio de bombeo (opcional).
                    Hasta {REMISION_DOCUMENT_MAX_MB}MB por archivo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-xs text-gray-600 mb-3">
                    <p>• Suba archivos existentes (imágenes, PDFs)</p>
                  </div>
                  
                  <SimpleFileUpload
                    onFileSelect={handleFileUpload}
                    acceptedTypes={['image/*', 'application/pdf']}
                    multiple
                    maxSize={REMISION_DOCUMENT_MAX_MB}
                    uploading={uploading}
                    disabled={loading}
                  />
                  
                  {/* Pending Files */}
                  {pendingFiles.length > 0 && (
                    <div className="mt-2 space-y-2">
                      <p className="text-sm text-gray-600">
                        {pendingFiles.length} archivo(s) en cola
                      </p>
                      {pendingFiles.map((fileInfo, index) => (
                        <div key={index} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-gray-500 truncate">{fileInfo.name}</span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              fileInfo.status === 'uploaded' ? 'bg-green-100 text-green-700' :
                              fileInfo.status === 'error' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {fileInfo.status}
                            </span>

                            {fileInfo.error && (
                              <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                                Error: {fileInfo.error}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removePendingFile(index)}
                            className="text-red-500 hover:text-red-700 ml-2"
                            title="Eliminar documento"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Existing Documents */}
                  {existingDocuments.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm text-gray-600">
                        Documentos subidos:
                      </p>
                      {existingDocuments.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between text-xs p-2 bg-green-50 rounded border border-green-200">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-gray-700 truncate">{doc.original_name}</span>
                            <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                              Subido
                            </span>
                            <span className="text-xs text-gray-500">
                              {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewDocument(doc)}
                              disabled={urlLoading(doc.file_path)}
                              className="text-blue-600 hover:text-blue-800 text-xs disabled:opacity-50"
                              title="Ver documento (genera enlace seguro)"
                            >
                              {urlLoading(doc.file_path) ? 'Cargando...' : 'Ver'}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteDocument(doc.id)}
                              className="text-red-500 hover:text-red-700 text-xs"
                              title="Eliminar documento"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {evidenceRetryRemisionId && (
                <Alert variant="destructive">
                  <AlertTitle>No se guardó toda la evidencia</AlertTitle>
                  <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      La remisión ya está registrada. Corrija los archivos con error y pulse reintentar, o vuelva atrás
                      para abandonar.
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      onClick={handleRetryEvidenceUpload}
                      disabled={loading || uploading}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reintentar evidencia
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <div className="flex justify-end pt-4 border-t mt-4">
                <button
                  type="submit"
                  disabled={loading || plantContextLoading || !formData.plantId || !!evidenceRetryRemisionId}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ border: '0' }}
                  title={
                    evidenceRetryRemisionId
                      ? 'Resuelva la evidencia pendiente antes de registrar otra remisión'
                      : undefined
                  }
                >
                  {loading ? 'Guardando...' : 'Guardar Remisión de Bombeo'}
                </button>
              </div>
            </form>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
