'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import type { AdditionalProduct, QuoteAdditionalProduct } from '@/types/additionalProducts';
import { calculateProductPrice } from '@/lib/services/additionalProductsService';

interface AdditionalProductsSelectorProps {
  quoteId?: string;
  plantId?: string;
  products: QuoteAdditionalProduct[];
  availableProducts: AdditionalProduct[];
  onAddProduct: (productId: string, quantity: number, marginPercentage: number) => Promise<void>;
  onRemoveProduct: (productId: string) => Promise<void>;
  onUpdateProduct?: (productId: string, quantity: number, marginPercentage: number) => Promise<void>;
  onProductCreated?: (createdProductId?: string) => Promise<void>;
  isLoading?: boolean;
}

export function AdditionalProductsSelector({
  quoteId,
  plantId,
  products,
  availableProducts,
  onAddProduct,
  onRemoveProduct,
  onUpdateProduct,
  onProductCreated,
  isLoading,
}: AdditionalProductsSelectorProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [marginPercentage, setMarginPercentage] = useState<number>(0);
  const [isAdding, setIsAdding] = useState(false);
  const [showCreateProductForm, setShowCreateProductForm] = useState(false);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [newProductCode, setNewProductCode] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState<AdditionalProduct['category']>('OTHER');
  const [newProductUnit, setNewProductUnit] = useState('m3');
  const [newProductBasePrice, setNewProductBasePrice] = useState<number>(0);
  const [newProductBillingType, setNewProductBillingType] = useState<'PER_M3' | 'PER_ORDER_FIXED' | 'PER_UNIT'>('PER_M3');
  const [editDrafts, setEditDrafts] = useState<Record<string, { quantity: number; margin: number }>>({});

  const unitDefaultByBilling: Record<string, string> = {
    PER_M3: 'm3',
    PER_UNIT: 'unidad',
    PER_ORDER_FIXED: 'orden',
  };

  const selectedProduct = availableProducts.find((p) => p.id === selectedProductId);
  const selectedBillingType = selectedProduct?.billing_type || 'PER_M3';

  useEffect(() => {
    setEditDrafts((prev) => {
      const next: Record<string, { quantity: number; margin: number }> = {};
      for (const product of products) {
        next[product.id] = prev[product.id] || {
          quantity: product.quantity,
          margin: product.margin_percentage,
        };
      }
      return next;
    });
  }, [products]);

  useEffect(() => {
    const unitMap: Record<string, string> = { PER_M3: 'm3', PER_UNIT: 'unidad', PER_ORDER_FIXED: 'orden' };
    setNewProductUnit(unitMap[newProductBillingType] ?? 'm3');
  }, [newProductBillingType]);

  useEffect(() => {
    if (selectedBillingType === 'PER_ORDER_FIXED') setQuantity(1);
  }, [selectedBillingType]);

  const handleAddProduct = async () => {
    if (!selectedProductId || quantity <= 0) return;

    setIsAdding(true);
    try {
      await onAddProduct(selectedProductId, quantity, marginPercentage);
      // Reset form
      setSelectedProductId('');
      setQuantity(1);
      setMarginPercentage(0);
    } catch (error) {
      console.error('Error adding product:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateProduct = async (productId: string, newQuantity: number, newMargin: number) => {
    if (!onUpdateProduct) return;
    try {
      await onUpdateProduct(productId, newQuantity, newMargin);
      toast.success('Producto adicional actualizado');
    } catch (error) {
      console.error('Error updating additional product:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el producto adicional');
    }
  };

  const handleCreateProduct = async () => {
    if (!newProductName.trim() || newProductBasePrice <= 0) return;
    setIsSavingProduct(true);
    try {
      const payload: Record<string, unknown> = {
        name: newProductName.trim(),
        category: newProductCategory,
        base_price: newProductBasePrice,
        plant_id: plantId || null,
        billing_type: newProductBillingType,
      };
      if (newProductCode.trim()) {
        payload.code = newProductCode.trim().toUpperCase();
      }
      const unitVal = newProductUnit.trim();
      if (unitVal) payload.unit = unitVal;
      const response = await fetch('/api/additional-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const res = await response.json();
      if (!response.ok) {
        throw new Error(res?.error || res?.message || 'No se pudo crear el producto adicional');
      }
      setNewProductCode('');
      setNewProductName('');
      setNewProductCategory('OTHER');
      setNewProductUnit('m3');
      setNewProductBasePrice(0);
      setNewProductBillingType('PER_M3');
      if (onProductCreated) {
        await onProductCreated(res?.id);
      }
      toast.success('Producto adicional creado correctamente');
    } catch (error) {
      console.error('Error creating additional product:', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el producto adicional');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const calculateUnitPrice = (basePrice: number, margin: number) => {
    return calculateProductPrice(basePrice, margin);
  };

  const totalSpecialProducts = products.reduce((sum, p) => sum + (p.total_price ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Add Product Form - Spacious vertical-first layout */}
      <div className="bg-gray-50 rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Selector de producto</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={() => setShowCreateProductForm((prev) => !prev)}
          >
            {showCreateProductForm ? 'Cerrar alta' : 'Nuevo producto'}
          </Button>
        </div>

        {showCreateProductForm && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Nombre *</Label>
                <Input
                  placeholder="Ej: Fibra polipropileno, Retemplado, Cuota semanal..."
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-sm font-medium text-gray-700">Precio base *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={newProductBasePrice || ''}
                    onChange={(e) => setNewProductBasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-sm font-medium text-gray-700">Tipo de cobro *</Label>
                  <Select value={newProductBillingType} onValueChange={(value) => setNewProductBillingType(value as 'PER_M3' | 'PER_ORDER_FIXED' | 'PER_UNIT')}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Tipo de cobro" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PER_M3">Por m³</SelectItem>
                      <SelectItem value="PER_ORDER_FIXED">Fijo por orden</SelectItem>
                      <SelectItem value="PER_UNIT">Por unidad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedFields((prev) => !prev)}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
              >
                {showAdvancedFields ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Opciones avanzadas (código, categoría, unidad)
              </button>
              {showAdvancedFields && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                  <div className="space-y-1.5 min-w-0">
                    <Label className="text-sm text-gray-600">Código (opcional)</Label>
                    <Input className="w-full" placeholder="Ej: FIB-600, RET-01" value={newProductCode} onChange={(e) => setNewProductCode(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label className="text-sm text-gray-600">Categoría</Label>
                    <Select value={newProductCategory} onValueChange={(value) => setNewProductCategory(value as AdditionalProduct['category'])}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Categoría" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SPECIAL_PRODUCT">Producto especial</SelectItem>
                        <SelectItem value="SERVICE">Servicio</SelectItem>
                        <SelectItem value="MATERIAL">Material</SelectItem>
                        <SelectItem value="EQUIPMENT">Equipo</SelectItem>
                        <SelectItem value="OTHER">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label className="text-sm text-gray-600">Unidad</Label>
                    <Input className="w-full" placeholder={unitDefaultByBilling[newProductBillingType] ?? 'm3'} value={newProductUnit} onChange={(e) => setNewProductUnit(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300"
              onClick={handleCreateProduct}
              disabled={!newProductName.trim() || newProductBasePrice <= 0 || isLoading || isSavingProduct}
            >
              {isSavingProduct ? 'Guardando...' : 'Guardar producto'}
            </Button>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-select" className="text-sm font-medium text-gray-700 block">
              Producto
            </Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger id="product-select" className="w-full h-10">
                <SelectValue placeholder="Seleccionar producto..." />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} - ${product.base_price.toFixed(2)}/{product.unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`space-y-2 ${selectedBillingType === 'PER_ORDER_FIXED' ? 'opacity-60' : ''}`}>
              <Label htmlFor="quantity" className="text-sm font-medium text-gray-700 block">
                {selectedBillingType === 'PER_M3' ? 'Factor por m³' : selectedBillingType === 'PER_UNIT' ? 'Cantidad' : 'Fijo por orden (cantidad no aplica)'}
              </Label>
              <Input
                id="quantity"
                type="number"
                min={selectedBillingType === 'PER_ORDER_FIXED' ? 1 : 0.01}
                step="0.01"
                value={selectedBillingType === 'PER_ORDER_FIXED' ? 1 : quantity}
                onChange={(e) => selectedBillingType !== 'PER_ORDER_FIXED' && setQuantity(parseFloat(e.target.value) || 0)}
                readOnly={selectedBillingType === 'PER_ORDER_FIXED'}
                className="w-full h-10"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="margin" className="text-sm font-medium text-gray-700 block">
                Margen % (MOP)
              </Label>
              <Input
                id="margin"
                type="number"
                min="0"
                step="0.1"
                value={marginPercentage}
                onChange={(e) => setMarginPercentage(parseFloat(e.target.value) || 0)}
                className="w-full h-10"
              />
            </div>
          </div>
          
          <Button
            onClick={handleAddProduct}
            disabled={!selectedProductId || quantity <= 0 || isAdding}
            className="w-full sm:w-auto px-6 h-10 bg-blue-600 text-[#404040] hover:bg-blue-700 disabled:bg-blue-300"
            size="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Producto
          </Button>
        </div>
        
        {selectedProduct && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Precio base:</span>
              <span className="text-sm font-medium text-gray-900">${selectedProduct.base_price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Precio unitario:</span>
              <span className="text-sm font-semibold text-blue-600">
                ${calculateUnitPrice(selectedProduct.base_price, marginPercentage).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-base font-semibold text-gray-700">Total:</span>
              <span className="text-base font-bold text-gray-900">
                ${(
                  selectedBillingType === 'PER_ORDER_FIXED'
                    ? calculateUnitPrice(selectedProduct.base_price, marginPercentage)
                    : calculateUnitPrice(selectedProduct.base_price, marginPercentage) * quantity
                ).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Products List */}
      <div className="space-y-3">
        {products.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8 bg-gray-50 rounded-lg">
            No hay productos especiales agregados
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {products.map((product) => {
                const productInfo = availableProducts.find(
                  (p) => p.id === product.additional_product_id
                );
                const draft = editDrafts[product.id] || {
                  quantity: product.quantity,
                  margin: product.margin_percentage,
                };
                return (
                  <div
                    key={product.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:border-gray-300 transition-colors gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 mb-1">{productInfo?.name || 'Producto'}</div>
                      <div className="text-sm text-gray-500">
                        {product.margin_percentage.toFixed(1)}% margen · {productInfo?.billing_type || product.billing_type || 'PER_M3'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {product.quantity} {productInfo?.unit || ''} × ${product.unit_price.toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="grid grid-cols-2 gap-2 w-52">
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={draft.quantity}
                          onChange={(e) =>
                            setEditDrafts((prev) => ({
                              ...prev,
                              [product.id]: {
                                quantity: parseFloat(e.target.value) || 0,
                                margin: draft.margin,
                              },
                            }))
                          }
                          disabled={isLoading}
                          className="h-9"
                        />
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={draft.margin}
                          onChange={(e) =>
                            setEditDrafts((prev) => ({
                              ...prev,
                              [product.id]: {
                                quantity: draft.quantity,
                                margin: parseFloat(e.target.value) || 0,
                              },
                            }))
                          }
                          disabled={isLoading}
                          className="h-9"
                        />
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900 text-lg">${product.total_price.toFixed(2)}</div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                          onClick={() => handleUpdateProduct(product.additional_product_id, draft.quantity, draft.margin)}
                          disabled={!onUpdateProduct || isLoading || draft.quantity <= 0}
                        >
                          Actualizar
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveProduct(product.additional_product_id)}
                        disabled={isLoading}
                        className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {products.length > 0 && (
              <div className="border-t-2 border-gray-300 pt-4 flex justify-between items-center font-semibold text-gray-900">
                <span className="text-base">Subtotal Productos Especiales:</span>
                <span className="text-xl">${totalSpecialProducts.toFixed(2)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

