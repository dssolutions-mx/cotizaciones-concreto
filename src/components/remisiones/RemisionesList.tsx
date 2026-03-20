'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Trash2, Edit, FileText, Eye, ArrowLeftRight, Factory, CheckCircle2, Clock, Building2 } from 'lucide-react';
import RemisionProductosAdicionalesList from './RemisionProductosAdicionalesList';
import RemisionProductoAdicionalForm from './RemisionProductoAdicionalForm';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import EditRemisionModal from './EditRemisionModal';
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { findProductPrice, explainPriceMatch } from '@/utils/salesDataProcessor';

interface RemisionesListProps {
  orderId: string;
  requiresInvoice?: boolean;
  constructionSite?: string;
  hasEmptyTruckCharge?: boolean;
  onRemisionesLoaded?: (data: any[]) => void;
}

// Format remisiones data for accounting software
export const formatRemisionesForAccounting = (
  remisiones: any[], 
  requiresInvoice: boolean = false, 
  constructionSite: string = "",
  hasEmptyTruckCharge: boolean = false,
  orderProducts: any[] = []
): string => {
  if (!remisiones || remisiones.length === 0) return "";
  
  // Helper function to properly format a date string without timezone issues
  const formatDateString = (dateStr: string): string => {
    if (!dateStr) return '-';
    
    // Parse the date string into parts to avoid timezone issues
    const [year, month, day] = dateStr.split('T')[0].split('-').map(num => parseInt(num, 10));
    // Create date with local timezone (without hours to avoid timezone shifts)
    const date = new Date(year, month - 1, day, 12, 0, 0);
    return format(date, 'dd/MM/yyyy', { locale: es });
  };
  
  // First, identify and list all remisiones
  let concreteRemisiones = remisiones.filter(r => r.tipo_remision === 'CONCRETO');
  const pumpRemisiones = remisiones.filter(r => r.tipo_remision === 'BOMBEO');
  
  // Sort remisiones by date/number to ensure consistent ordering
  concreteRemisiones = concreteRemisiones.sort((a, b) => {
    // Compare by date first, then by remision_number if dates are equal
    const dateA = new Date(a.fecha || 0);
    const dateB = new Date(b.fecha || 0);
    
    if (dateA.getTime() !== dateB.getTime()) {
      return dateA.getTime() - dateB.getTime();
    }
    
    return (a.remision_number ?? '').localeCompare(b.remision_number ?? '', undefined, { numeric: true });
  });
  
  // Create header for the table
  const headers = [
    "FOLIO REMISION", 
    "FECHA", 
    "OBSERVACIONES", 
    "CODIGO DE PRODUCTO", 
    "VOLUMEN", 
    "PRECIO DE VENTA", 
    "PLANTA"
  ].join("\t");
  
  // Process each remision
  const rows: string[] = [];
  
  // Use shared sophisticated price finding utility
  const getProductPrice = (productType: string, remisionOrderId: string, recipeId?: string): number => {
    return findProductPrice(productType, remisionOrderId, recipeId, orderProducts);
  };
  
  // Strict order-specific price getters for pump and vacío de olla based ONLY on order_items
  const getOrderSpecificPumpPrice = (orderId: string): number => {
    const qd = (p: any) => (p?.quote_details ? (Array.isArray(p.quote_details) ? p.quote_details[0] : p.quote_details) : undefined);
    const normalizeName = (s: string) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    const items = orderProducts.filter((p: any) => String(p.order_id) === String(orderId));
    // Key factor: match strictly by product_type name
    let item = items.find((p: any) => normalizeName(p.product_type) === 'SERVICIO DE BOMBEO');
    // Last resort fallback to legacy flags/codes if naming is missing
    if (!item) {
      item = items.find((p: any) => p.has_pump_service || p.product_type === 'SER002');
    }
    return (
      item?.pump_price ??
      item?.unit_price ??
      qd(item)?.final_price ??
      0
    );
  };
  
  const getOrderSpecificEmptyTruckPrice = (orderId: string): number => {
    const qd = (p: any) => (p?.quote_details ? (Array.isArray(p.quote_details) ? p.quote_details[0] : p.quote_details) : undefined);
    const normalizeName = (s: string) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    const items = orderProducts.filter((p: any) => String(p.order_id) === String(orderId));
    // Key factor: match strictly by product_type name
    let item = items.find((p: any) => {
      const name = normalizeName(p.product_type);
      return name === 'VACIO DE OLLA' || name === 'EMPTY_TRUCK_CHARGE';
    });
    // Last resort fallback to legacy flags/codes if naming is missing
    if (!item) {
      item = items.find((p: any) => p.product_type === 'VACÍO DE OLLA' || p.has_empty_truck_charge || p.product_type === 'SER001');
    }
    return (
      item?.empty_truck_price ??
      item?.unit_price ??
      qd(item)?.final_price ??
      0
    );
  };
  
  // Determine display code: use remision's recipe_id and recipe data
  const getDisplayProductCodeForRemision = (remision: any): string => {
    // 1) Explicit designation on the remision takes priority
    if (remision?.designacion_ehe) {
      return remision.designacion_ehe.replace(/-/g, '');
    }

    // 2) Use recipe code from remision
    const recipeCode = remision?.recipe?.recipe_code || '';
    return (recipeCode || 'PRODUCTO').replace(/-/g, '');
  };
  
  // First handle VACIO DE OLLA if any exists (should be assigned first remision number)
  // Only include if hasEmptyTruckCharge is true
  if (concreteRemisiones.length > 0 && hasEmptyTruckCharge) {
    // Use the first concrete remision for vacio de olla
    const firstRemision = concreteRemisiones[0];
    const prefix = "A-";
    const plantaPrefix = requiresInvoice ? "Remision " : "NVRemision ";
    
    // Format the date
    const dateFormatted = formatDateString(firstRemision.fecha);
    
    // Get price for vacío de olla strictly from order_items of the same order
    const emptyTruckPrice = getOrderSpecificEmptyTruckPrice(firstRemision.order_id);
    
    // Add row for "VACIO DE OLLA" with code SER001
    rows.push([
      `${prefix}${firstRemision.remision_number}`,
      dateFormatted,
      constructionSite || "N/A",
      "SER001", // Código para VACIO DE OLLA
      "1.00", // Fixed value for vacío de olla
      emptyTruckPrice.toFixed(2), // Empty truck price
      `${plantaPrefix}1-SILAO`
    ].join("\t"));
  }
  
  // Then add concrete remisiones
  concreteRemisiones.forEach(remision => {
    const prefix = "A-";
    const plantaPrefix = requiresInvoice ? "Remision " : "NVRemision ";
    
    // Format the date
    const dateFormatted = formatDateString(remision.fecha);
    
    // Get original product code from recipe code for price lookup
    const originalProductCode = remision.recipe?.recipe_code || "PRODUCTO";

    // Use remision's recipe_id directly for price matching
    const effectiveRecipeId = remision.recipe_id;

    // Determine display using direct recipe_id match
    const displayProductCode = getDisplayProductCodeForRemision(remision);

    // Get price for this product using original product code, recipe_id, and master_recipe_id
    const remisionMasterRecipeId = remision.master_recipe_id || remision.recipe?.master_recipe_id;
    let productPrice = findProductPrice(
      originalProductCode,
      remision.order_id,
      effectiveRecipeId,
      orderProducts,
      undefined, // pricingMap - not used in copy flow
      undefined, // remisionId - not used
      remisionMasterRecipeId
    );
    if (!productPrice || productPrice === 0) {
      const dbg = explainPriceMatch(originalProductCode, remision.order_id, effectiveRecipeId, orderProducts);
      console.debug('CopyDebug Concrete', { remision: remision.remision_number, recipe: originalProductCode, recipeId: effectiveRecipeId, dbg });
      if (dbg.priceSelected && dbg.priceSelected > 0) {
        productPrice = dbg.priceSelected;
      }
    }
    
    rows.push([
      `${prefix}${remision.remision_number}`,
      dateFormatted,
      constructionSite || "N/A",
      displayProductCode,
      remision.volumen_fabricado.toFixed(2),
      productPrice.toFixed(2), // Product price
      `${plantaPrefix}1-SILAO`
    ].join("\t"));
  });
  
  // Add pump remisiones
  pumpRemisiones.forEach(remision => {
    const prefix = "A-";
    const plantaPrefix = requiresInvoice ? "Remision " : "NVRemision ";
    
    // Format the date
    const dateFormatted = formatDateString(remision.fecha);
    
    // Get price for pump service strictly from order_items of the same order
    const pumpPrice = getOrderSpecificPumpPrice(remision.order_id);
    
    rows.push([
      `${prefix}${remision.remision_number}`,
      dateFormatted,
      constructionSite || "N/A",
      "SER002", // Código para BOMBEO
      remision.volumen_fabricado.toFixed(2),
      pumpPrice.toFixed(2), // Pump price
      `${plantaPrefix}1-SILAO`
    ].join("\t"));
  });

  // Add additional products from order_items
  const additionalItems = (orderProducts || []).filter((item: any) =>
    item?.product_type?.startsWith('PRODUCTO ADICIONAL:')
  );

  additionalItems.forEach((item: any) => {
    const orderId = item.order_id;
    const orderConcreteVolume = concreteRemisiones
      .filter(r => r.order_id === orderId)
      .reduce((sum, r) => sum + (r.volumen_fabricado || 0), 0);
    const referenceRemision =
      concreteRemisiones.find(r => r.order_id === orderId) ||
      pumpRemisiones.find(r => r.order_id === orderId) ||
      remisiones.find(r => r.order_id === orderId);

    if (!referenceRemision) return;

    const prefix = "A-";
    const plantaPrefix = requiresInvoice ? "Remision " : "NVRemision ";
    const dateFormatted = formatDateString(referenceRemision.fecha);
    const billingType = item.billing_type || 'PER_M3';
    const baseUnitPrice = Number(item.unit_price || 0);
    const itemVolume = Number(item.volume || 0);

    const exportVolume =
      billingType === 'PER_ORDER_FIXED' ? 1 :
      billingType === 'PER_UNIT' ? itemVolume :
      orderConcreteVolume;

    const exportUnitPrice =
      billingType === 'PER_M3'
        ? itemVolume * baseUnitPrice
        : baseUnitPrice;

    const codeMatch = item.product_type.match(/\(([^)]+)\)\s*$/);
    const productCode = codeMatch?.[1] || 'ADDL';

    rows.push([
      `${prefix}${referenceRemision.remision_number}`,
      dateFormatted,
      constructionSite || "N/A",
      productCode,
      exportVolume.toFixed(2),
      exportUnitPrice.toFixed(2),
      `${plantaPrefix}1-SILAO`
    ].join("\t"));
  });
  
  // Combine headers and rows
  return `${headers}\n${rows.join("\n")}`;
};

// Component to display evidence for a single pumping remision
function PumpingRemisionEvidence({ remisionId, remisionNumber }: { remisionId: string; remisionNumber: string }) {
  const [evidence, setEvidence] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getSignedUrl, isLoading: urlLoading } = useSignedUrls('remision-documents', 3600);

  useEffect(() => {
    const fetchEvidence = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/remisiones/documents?remision_id=${remisionId}&document_category=pumping_remision`);
        
        if (!response.ok) {
          throw new Error('Error al obtener evidencia');
        }
        
        const result = await response.json();
        setEvidence(result.data || []);
      } catch (err) {
        console.error('Error fetching evidence:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchEvidence();
  }, [remisionId]);

  const handleViewEvidence = async (evidenceItem: any) => {
    try {
      const signedUrl = await getSignedUrl(evidenceItem.file_path);
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      } else {
        toast.error('No se pudo generar el enlace para ver el documento');
      }
    } catch (error) {
      console.error('Error viewing evidence:', error);
      toast.error('Error al abrir el documento');
    }
  };

  const formatDateSafely = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
    } catch {
      return dateStr;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('text/')) return '📝';
    return '📎';
  };

  if (loading) {
    return (
      <div className="p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="w-4 h-4 border-t-2 border-b-2 border-gray-400 rounded-full animate-spin"></div>
          Cargando evidencia para remisión #{remisionNumber}...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
        <div className="text-sm text-red-600">
          Error al cargar evidencia para remisión #{remisionNumber}: {error}
        </div>
      </div>
    );
  }

  if (evidence.length === 0) {
    return (
      <div className="p-3 bg-gray-50 rounded-lg border">
        <div className="text-sm text-gray-600">
          Remisión #{remisionNumber}: Sin documentos de evidencia
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-gray-50 rounded-lg border">
      <div className="flex items-center justify-between mb-2">
        <h5 className="text-sm font-medium text-gray-900">
          Remisión #{remisionNumber}
        </h5>
        <Badge variant="outline" className="bg-blue-50 text-blue-700">
          {evidence.length} {evidence.length === 1 ? 'documento' : 'documentos'}
        </Badge>
      </div>
      
      <div className="space-y-2">
        {evidence.map((evidenceItem) => (
          <div
            key={evidenceItem.id}
            className="flex items-center justify-between p-2 bg-white rounded border"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm">{getFileIcon(evidenceItem.mime_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {evidenceItem.original_name}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{formatFileSize(evidenceItem.file_size)}</span>
                  <span>•</span>
                  <span>{formatDateSafely(evidenceItem.created_at)}</span>
                </div>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleViewEvidence(evidenceItem)}
              disabled={urlLoading(evidenceItem.file_path)}
              className="flex items-center gap-1 ml-2"
            >
              {urlLoading(evidenceItem.file_path) ? (
                <div className="w-3 h-3 border-t border-gray-400 rounded-full animate-spin"></div>
              ) : (
                <Eye className="h-3 w-3" />
              )}
              Ver
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RemisionesList({ orderId, requiresInvoice, constructionSite, hasEmptyTruckCharge, onRemisionesLoaded }: RemisionesListProps) {
  const [remisiones, setRemisiones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRemisionId, setExpandedRemisionId] = useState<string | null>(null);
  const [linkedProduction, setLinkedProduction] = useState<any[]>([]);
  const [billingCrossPlant, setBillingCrossPlant] = useState<any[]>([]);
  const [linkedLoading, setLinkedLoading] = useState(false);
  const [expandedRecipes, setExpandedRecipes] = useState<Record<string, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [remisionToDelete, setRemisionToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingRemision, setEditingRemision] = useState<any>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  
  // Helper function to safely format dates without timezone issues
  const formatDateSafely = (dateStr: string): string => {
    if (!dateStr) return '-';
    
    // Parse the date string into parts to avoid timezone issues
    const [year, month, day] = dateStr.split('T')[0].split('-').map(num => parseInt(num, 10));
    // Create date with local timezone (without hours to avoid timezone shifts)
    const date = new Date(year, month - 1, day, 12, 0, 0);
    return format(date, 'dd/MM/yyyy', { locale: es });
  };
  
  const fetchRemisiones = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('remisiones')
        .select(`
          *,
          recipe:recipes(recipe_code),
          materiales:remision_materiales(*)
        `)
        .eq('order_id', orderId)
        .order('fecha', { ascending: true });
      
      if (error) throw error;
      
      // Sort by remision_number in ascending order
      const sortedData = [...(data || [])].sort((a, b) => {
        return (a.remision_number ?? '').localeCompare(b.remision_number ?? '', undefined, { numeric: true });
      });
      
      setRemisiones(sortedData);
      
      // Call the callback if provided to notify parent component about the data
      if (onRemisionesLoaded) {
        onRemisionesLoaded(sortedData || []);
      }
    } catch (err: any) {
      console.error('Error cargando remisiones:', err);
      setError(err.message || 'Error al cargar las remisiones');
    } finally {
      setLoading(false);
    }
  }, [orderId, onRemisionesLoaded]);
  
  useEffect(() => {
    fetchRemisiones();
  }, [fetchRemisiones]);

  // Fetch Plant B production records linked to this order's billing remisiones
  useEffect(() => {
    if (!orderId) return;
    setLinkedLoading(true);
    fetch(`/api/production-control/cross-plant-linked?order_id=${orderId}`)
      .then(r => r.json())
      .then(d => {
        setLinkedProduction(d.linked || []);
        setBillingCrossPlant(d.billingCrossPlant || []);
      })
      .catch(() => {})
      .finally(() => setLinkedLoading(false));
  }, [orderId]);

  // Agrupar remisiones por tipo
  const concreteRemisiones = remisiones.filter(r => r.tipo_remision === 'CONCRETO');
  const pumpRemisiones = remisiones.filter(r => r.tipo_remision === 'BOMBEO');
  
  // Calcular totales
  const totalConcreteVolume = concreteRemisiones.reduce((sum, r) => sum + r.volumen_fabricado, 0);
  const totalPumpVolume = pumpRemisiones.reduce((sum, r) => sum + r.volumen_fabricado, 0);
  
  // Group concrete remisiones by recipe code for display
  const recipeGroups = concreteRemisiones.reduce<Record<string, any[]>>((acc, remision) => {
    const recipeCode = remision.recipe?.recipe_code || 'Sin receta';
    if (!acc[recipeCode]) {
      acc[recipeCode] = [];
    }
    acc[recipeCode].push(remision);
    return acc;
  }, {});
  
  // Agrupar remisiones de concreto por receta (for summary badges)
  const concreteByRecipe = concreteRemisiones.reduce<Record<string, { volume: number; count: number }>>((acc, remision) => {
    const recipeCode = remision.recipe?.recipe_code || 'Sin receta';
    if (!acc[recipeCode]) {
      acc[recipeCode] = {
        volume: 0,
        count: 0
      };
    }
    acc[recipeCode].volume += remision.volumen_fabricado;
    acc[recipeCode].count += 1;
    return acc;
  }, {});

  const toggleExpand = (remisionId: string) => {
    setExpandedRemisionId(prevId => (prevId === remisionId ? null : remisionId));
  };
  
  const toggleRecipeExpand = (recipeCode: string) => {
    setExpandedRecipes(prev => ({
      ...prev,
      [recipeCode]: !prev[recipeCode]
    }));
  };
  
  const handleAdditionalProductUpdate = () => {
    console.log("Additional product updated, potentially refresh needed");
    fetchRemisiones();
  };
  
  const handleDeleteClick = (remision: any) => {
    setRemisionToDelete(remision);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (remision: any) => {
    setEditingRemision(remision);
    setEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    fetchRemisiones();
    setEditModalOpen(false);
    setEditingRemision(null);
  };
  
  const confirmDelete = async () => {
    if (!remisionToDelete) return;
    
    setIsDeleting(true);
    try {
      // First delete any related remision_materiales
      await supabase
        .from('remision_materiales')
        .delete()
        .eq('remision_id', remisionToDelete.id);
      
      // Then delete any related productos_adicionales
      await supabase
        .from('remision_productos_adicionales')
        .delete()
        .eq('remision_id', remisionToDelete.id);
      
      // Finally delete the remision
      const { error } = await supabase
        .from('remisiones')
        .delete()
        .eq('id', remisionToDelete.id);
      
      if (error) throw error;
      
      toast.success(`Remisión ${remisionToDelete.remision_number} eliminada correctamente`);
      
      // Refresh the list
      fetchRemisiones();
    } catch (err: any) {
      console.error('Error eliminando remisión:', err);
      toast.error(`Error al eliminar remisión: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setRemisionToDelete(null);
    }
  };
  
  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <div className="w-8 h-8 border-t-2 border-b-2 border-green-600 rounded-full animate-spin"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="text-red-500 text-center">{error}</div>
        </CardContent>
      </Card>
    );
  }
  
  if (remisiones.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-gray-500">
            No hay remisiones registradas para esta orden
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Remisiones Registradas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 mb-4">
            <div className="text-sm font-medium">Remisiones Registradas</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(concreteByRecipe).map(([recipe, data], index) => (
                <Badge key={`recipe-list-${index}-${recipe}`} variant="outline" className="bg-blue-50">
                  {recipe}: {data.volume.toFixed(2)} m³
                </Badge>
              ))}
              <Badge variant="outline" className="bg-green-50">
                Bombeo: {totalPumpVolume.toFixed(2)} m³
              </Badge>
            </div>
          </div>
          
          {concreteRemisiones.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base font-medium mb-3">Remisiones de Concreto</h3>
              
              {/* Recipe groups */}
              {Object.entries(recipeGroups).map(([recipeCode, recipeRemisiones], index) => (
                <div key={`recipe-group-${index}-${recipeCode}`} className="mb-4">
                  <div 
                    onClick={() => toggleRecipeExpand(recipeCode)} 
                    className="flex items-center bg-gray-100 p-3 rounded-t-md cursor-pointer border"
                  >
                    {expandedRecipes[recipeCode] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <span className="ml-2 font-medium">{recipeCode}</span>
                    <span className="ml-2 text-gray-600">
                      ({recipeRemisiones.length} remisiones, {concreteByRecipe[recipeCode].volume.toFixed(2)} m³)
                    </span>
                  </div>
                  
                  {expandedRecipes[recipeCode] && (
                    <div className="overflow-x-auto border border-t-0 rounded-b-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>№ Remisión</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Conductor</TableHead>
                            <TableHead>Unidad</TableHead>
                            <TableHead className="text-right">Volumen</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recipeRemisiones.map((remision) => (
                            <React.Fragment key={remision.id}>
                              <TableRow onClick={() => toggleExpand(remision.id)} className="cursor-pointer hover:bg-gray-50">
                                <TableCell>
                                  <button className="flex items-center gap-2 text-blue-600 hover:text-blue-800">
                                    {expandedRemisionId === remision.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    <span className="font-medium">{remision.remision_number}</span>
                                    {remision.cross_plant_billing_plant_id && (
                                      <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded px-1 py-0.5 flex items-center gap-1">
                                        <ArrowLeftRight size={10} />
                                        Prod. Cruzada
                                      </span>
                                    )}
                                  </button>
                                </TableCell>
                                <TableCell>
                                  {formatDateSafely(remision.fecha)}
                                </TableCell>
                                <TableCell>{remision.conductor || '-'}</TableCell>
                                <TableCell>{remision.unidad || '-'}</TableCell>
                                <TableCell className="text-right">{remision.volumen_fabricado.toFixed(2)} m³</TableCell>
                                <TableCell className="text-right">
                                  <div onClick={(e) => e.stopPropagation()} className="flex gap-1 justify-end">
                                    <RoleProtectedButton
                                      allowedRoles={['DOSIFICADOR', 'PLANT_MANAGER', 'EXECUTIVE']}
                                      onClick={() => handleEditClick(remision)}
                                      className="p-1.5 rounded text-blue-600 hover:bg-blue-50"
                                      title="Editar remisión"
                                    >
                                      <Edit size={16} />
                                    </RoleProtectedButton>
                                    <RoleProtectedButton
                                      allowedRoles={'EXECUTIVE'}
                                      onClick={() => handleDeleteClick(remision)}
                                      className="p-1.5 rounded text-red-600 hover:bg-red-50"
                                      title="Eliminar remisión"
                                    >
                                      <Trash2 size={16} />
                                    </RoleProtectedButton>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {expandedRemisionId === remision.id && (
                                <TableRow>
                                  <TableCell colSpan={6} className="p-0">
                                    <div className="p-4 bg-gray-50 border-t">
                                      {/* Cross-plant production detail */}
                                      {remision.cross_plant_billing_plant_id && (() => {
                                        const cpInfo = billingCrossPlant.find(b => b.billing_remision_id === remision.id);
                                        const prodRecord = linkedProduction.find(p => p.billing_remision_number === remision.remision_number);
                                        const isResolved = !!prodRecord;
                                        const plantName = cpInfo?.producing_plant_name || 'otra planta';
                                        return (
                                          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
                                            <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 border-b border-amber-200">
                                              <ArrowLeftRight className="h-4 w-4 text-amber-700 shrink-0" />
                                              <span className="text-sm font-semibold text-amber-800">Producción cruzada — {plantName}</span>
                                              {isResolved
                                                ? <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5"><CheckCircle2 className="h-3 w-3" /> Vinculada</span>
                                                : <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-200 border border-amber-300 rounded-full px-2 py-0.5"><Clock className="h-3 w-3" /> Pendiente</span>
                                              }
                                            </div>
                                            {isResolved && prodRecord ? (
                                              <div className="px-4 py-3 grid grid-cols-3 gap-4 text-sm">
                                                <div>
                                                  <p className="text-xs text-amber-600 font-medium uppercase tracking-wide mb-0.5">Remisión producción</p>
                                                  <p className="font-semibold text-amber-900">{prodRecord.remision_number}</p>
                                                </div>
                                                <div>
                                                  <p className="text-xs text-amber-600 font-medium uppercase tracking-wide mb-0.5">Planta</p>
                                                  <p className="font-semibold text-amber-900">{prodRecord.production_plant_name || plantName}</p>
                                                </div>
                                                <div>
                                                  <p className="text-xs text-amber-600 font-medium uppercase tracking-wide mb-0.5">Volumen real</p>
                                                  <p className="font-semibold text-amber-900">{prodRecord.volumen_fabricado?.toFixed(2)} m³</p>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="px-4 py-3 text-sm text-amber-700">
                                                Este concreto se producirá en <strong>{plantName}</strong>. El registro de producción aún no ha sido vinculado.
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                      <h4 className="text-sm font-semibold mb-3">Detalles y Productos Adicionales</h4>
                                      <RemisionProductosAdicionalesList 
                                        remisionId={remision.id} 
                                        onProductDelete={handleAdditionalProductUpdate} 
                                      />
                                      <RemisionProductoAdicionalForm 
                                        remisionId={remision.id} 
                                        onSuccess={handleAdditionalProductUpdate} 
                                      />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {pumpRemisiones.length > 0 && (
            <div>
              <h3 className="text-base font-medium mb-3">Remisiones de Bombeo</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>№ Remisión</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Conductor</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="text-right">Volumen</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pumpRemisiones.map((remision) => (
                      <TableRow key={remision.id}>
                        <TableCell className="font-medium">{remision.remision_number}</TableCell>
                        <TableCell>
                          {formatDateSafely(remision.fecha)}
                        </TableCell>
                        <TableCell>{remision.conductor || '-'}</TableCell>
                        <TableCell>{remision.unidad || '-'}</TableCell>
                        <TableCell className="text-right">{remision.volumen_fabricado.toFixed(2)} m³</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <RoleProtectedButton
                              allowedRoles={['DOSIFICADOR', 'PLANT_MANAGER', 'EXECUTIVE']}
                              onClick={() => handleEditClick(remision)}
                              className="p-1.5 rounded text-blue-600 hover:bg-blue-50"
                              title="Editar remisión"
                            >
                              <Edit size={16} />
                            </RoleProtectedButton>
                            <RoleProtectedButton
                              allowedRoles={'EXECUTIVE'}
                              onClick={() => handleDeleteClick(remision)}
                              className="p-1.5 rounded text-red-600 hover:bg-red-50"
                              title="Eliminar remisión"
                            >
                              <Trash2 size={16} />
                            </RoleProtectedButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Evidence Section for Pumping Remisiones */}
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Evidencia de Remisiones de Bombeo
                </h4>
                <div className="space-y-3">
                  {pumpRemisiones.map((remision) => (
                    <PumpingRemisionEvidence key={remision.id} remisionId={remision.id} remisionNumber={remision.remision_number} />
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Producción vinculada — Plant B records linked to this order */}
          {(linkedLoading || linkedProduction.length > 0 || billingCrossPlant.length > 0) && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-base font-medium mb-3 flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-amber-600" />
                Producción en otra planta
              </h3>

              {linkedLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                  <div className="w-4 h-4 border-2 border-t-amber-500 border-amber-200 rounded-full animate-spin" />
                  Cargando registros de producción cruzada...
                </div>
              ) : linkedProduction.length > 0 ? (
                <div className="rounded-lg border border-amber-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-amber-50">
                        <TableHead className="text-amber-800">Rem. Producción</TableHead>
                        <TableHead className="text-amber-800">Planta productora</TableHead>
                        <TableHead className="text-amber-800">Fecha</TableHead>
                        <TableHead className="text-amber-800">Conductor</TableHead>
                        <TableHead className="text-amber-800 text-right">Volumen</TableHead>
                        <TableHead className="text-amber-800 text-right">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linkedProduction.map(prod => (
                        <TableRow key={prod.id} className="bg-amber-50/30 hover:bg-amber-50/60">
                          <TableCell className="font-semibold text-amber-900">{prod.remision_number}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm text-gray-700">
                              <Factory className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                              {prod.production_plant_name || '—'}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-700">{prod.fecha ? formatDateSafely(prod.fecha) : '—'}</TableCell>
                          <TableCell className="text-sm text-gray-700">{prod.conductor || '—'}</TableCell>
                          <TableCell className="text-right font-medium text-gray-900">{prod.volumen_fabricado?.toFixed(2)} m³</TableCell>
                          <TableCell className="text-right">
                            {prod.is_resolved
                              ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5"><CheckCircle2 className="h-3 w-3" /> Vinculada</span>
                              : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5"><Clock className="h-3 w-3" /> Pendiente</span>
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : billingCrossPlant.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
                  {billingCrossPlant.map(b => (
                    <div key={b.billing_remision_id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-amber-800">
                        <Factory className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>Rem. <strong>{b.billing_remision_number}</strong> — producida en <strong>{b.producing_plant_name || 'otra planta'}</strong></span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-200 border border-amber-300 rounded-full px-2 py-0.5">
                        <Clock className="h-3 w-3" /> Sin registro
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar la remisión {remisionToDelete?.remision_number}? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar Remisión'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      {editingRemision && (
        <EditRemisionModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          remision={editingRemision}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
} 