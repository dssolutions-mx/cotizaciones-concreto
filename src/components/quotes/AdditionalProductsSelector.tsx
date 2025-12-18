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
import { Plus, Trash2 } from 'lucide-react';
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
  isLoading,
}: AdditionalProductsSelectorProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [marginPercentage, setMarginPercentage] = useState<number>(0);
  const [isAdding, setIsAdding] = useState(false);

  const selectedProduct = availableProducts.find((p) => p.id === selectedProductId);

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
    if (onUpdateProduct) {
      await onUpdateProduct(productId, newQuantity, newMargin);
    }
  };

  const calculateUnitPrice = (basePrice: number, margin: number) => {
    return calculateProductPrice(basePrice, margin);
  };

  const totalSpecialProducts = products.reduce((sum, p) => sum + p.total_price, 0);

  return (
    <div className="space-y-6">
      {/* Add Product Form - Spacious vertical-first layout */}
      <div className="bg-gray-50 rounded-lg p-6 space-y-5">
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
            <div className="space-y-2">
              <Label htmlFor="quantity" className="text-sm font-medium text-gray-700 block">
                Cantidad
              </Label>
              <Input
                id="quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
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
            className="w-full sm:w-auto px-6 h-10"
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
                ${(calculateUnitPrice(selectedProduct.base_price, marginPercentage) * quantity).toFixed(2)}
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
                return (
                  <div
                    key={product.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:border-gray-300 transition-colors gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 mb-1">{productInfo?.name || 'Producto'}</div>
                      <div className="text-sm text-gray-500">
                        {product.quantity} {productInfo?.unit || ''} × ${product.unit_price.toFixed(2)} 
                        {' '}(Margen: {product.margin_percentage.toFixed(1)}%)
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="font-semibold text-gray-900 text-lg">${product.total_price.toFixed(2)}</div>
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

