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
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import RemisionProductosAdicionalesList from './RemisionProductosAdicionalesList';
import RemisionProductoAdicionalForm from './RemisionProductoAdicionalForm';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
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
    
    return a.remision_number.localeCompare(b.remision_number);
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
  
  // Function to find price for a product type
  const findProductPrice = (productType: string): number => {
    if (!orderProducts || orderProducts.length === 0) return 0;
    
    // For SER001 (Vacío de Olla)
    if (productType === 'SER001') {
      const emptyTruckProduct = orderProducts.find(p => 
        p.product_type === 'VACÍO DE OLLA' || p.has_empty_truck_charge
      );
      return emptyTruckProduct?.empty_truck_price || 0;
    }
    
    // For SER002 (Bombeo)
    if (productType === 'SER002') {
      const pumpProduct = orderProducts.find(p => p.has_pump_service);
      return pumpProduct?.pump_price || 0;
    }
    
    // For concrete products, match by recipe code
    const concreteProduct = orderProducts.find(p => 
      p.product_type === productType || 
      (p.recipe_id && p.recipe_id.toString() === productType)
    );
    
    return concreteProduct?.unit_price || 0;
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
    
    // Get price for vacío de olla
    const emptyTruckPrice = findProductPrice('SER001');
    
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
    
    // Get product code from recipe code if available
    const productCode = remision.recipe?.recipe_code || "PRODUCTO";
    
    // Get price for this product
    const productPrice = findProductPrice(productCode);
    
    rows.push([
      `${prefix}${remision.remision_number}`,
      dateFormatted,
      constructionSite || "N/A",
      productCode,
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
    
    // Get price for pump service
    const pumpPrice = findProductPrice('SER002');
    
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
  
  // Combine headers and rows
  return `${headers}\n${rows.join("\n")}`;
};

export default function RemisionesList({ orderId, requiresInvoice, constructionSite, hasEmptyTruckCharge, onRemisionesLoaded }: RemisionesListProps) {
  const [remisiones, setRemisiones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRemisionId, setExpandedRemisionId] = useState<string | null>(null);
  const [expandedRecipes, setExpandedRecipes] = useState<Record<string, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [remisionToDelete, setRemisionToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
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
        return a.remision_number.localeCompare(b.remision_number, undefined, { numeric: true });
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
              {Object.entries(concreteByRecipe).map(([recipe, data]) => (
                <Badge key={recipe} variant="outline" className="bg-blue-50">
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
              {Object.entries(recipeGroups).map(([recipeCode, recipeRemisiones]) => (
                <div key={recipeCode} className="mb-4">
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
                                  <button className="flex items-center text-blue-600 hover:text-blue-800">
                                    {expandedRemisionId === remision.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    <span className="ml-1 font-medium">{remision.remision_number}</span>
                                  </button>
                                </TableCell>
                                <TableCell>
                                  {formatDateSafely(remision.fecha)}
                                </TableCell>
                                <TableCell>{remision.conductor || '-'}</TableCell>
                                <TableCell>{remision.unidad || '-'}</TableCell>
                                <TableCell className="text-right">{remision.volumen_fabricado.toFixed(2)} m³</TableCell>
                                <TableCell className="text-right">
                                  <div onClick={(e) => e.stopPropagation()}>
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
                          <RoleProtectedButton
                            allowedRoles={'EXECUTIVE'}
                            onClick={() => handleDeleteClick(remision)}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50"
                            title="Eliminar remisión"
                          >
                            <Trash2 size={16} />
                          </RoleProtectedButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
              variant="outline"
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
    </div>
  );
} 