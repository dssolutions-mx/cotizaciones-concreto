/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { clientService } from '@/lib/supabase/clients';
import { recipeService } from '@/lib/supabase/recipes';
import { priceService } from '@/lib/supabase/prices';
import { calculateBasePrice } from '@/lib/utils/priceCalculator';
import { createQuote, QuotesService } from '@/services/quotes';
import { supabase } from '@/lib/supabase';

interface Client {
  id: string;
  business_name: string;
  client_code: string;
}

interface Recipe {
  id: string;
  recipe_code: string;
  strength_fc: number;
  placement_type: string;
  slump: number;
  max_aggregate_size: number;
  recipe_type?: string;
}

interface RecipeVersion {
  id: string;
  version_number: number;
  is_current: boolean;
  materials: { 
    material_type: string; 
    quantity: number; 
    unit: string; 
  }[];
  recipe_id?: string;
  strength_fc?: number;
  placement_type?: string;
}

interface QuoteProduct {
  recipe: Recipe;
  basePrice: number;
  volume: number;
  profitMargin: number;
  finalPrice: number;
  // Pump service is now handled at the quote level, not per product
}

export default function QuoteBuilder() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [quoteProducts, setQuoteProducts] = useState<QuoteProduct[]>([]);
  const [clientHistory, setClientHistory] = useState<any[]>([]);
  const [constructionSite, setConstructionSite] = useState('');
  const [location, setLocation] = useState('');
  const [validityDate, setValidityDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedStrengths, setExpandedStrengths] = useState<number[]>([]);
  const [expandedTypes, setExpandedTypes] = useState<string[]>([]);
  const [includePumpService, setIncludePumpService] = useState<boolean>(false);
  const [pumpServicePrice, setPumpServicePrice] = useState<number>(0);
  const [includesVAT, setIncludesVAT] = useState<boolean>(false);

  // Load initial data - clients and recipes
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        const [clientsData, recipesResponse] = await Promise.all([
          clientService.getAllClients(),
          recipeService.getRecipes()
        ]);
        
        setClients(clientsData);
        
        const recipesData = recipesResponse.data || [];
        setRecipes(recipesData.map(r => ({
          id: r.id,
          recipe_code: r.recipe_code,
          strength_fc: r.strength_fc,
          placement_type: r.placement_type,
          slump: r.slump,
          max_aggregate_size: r.max_aggregate_size,
          recipe_type: r.recipe_type || 'N/A'
        })));
      } catch (error) {
        console.error('Error loading initial data:', error);
        alert('Error loading initial data. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Load client history when client is selected
  useEffect(() => {
    const loadClientHistory = async () => {
      if (selectedClient) {
        try {
          setIsLoading(true);
          const history = await priceService.getClientQuoteHistory(selectedClient);
          setClientHistory(history);
        } catch (error) {
          console.error('Error loading client history:', error);
          alert('Error loading client history.');
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadClientHistory();
  }, [selectedClient]);

  // Toggle function for expansion
  const toggleStrength = (strength: number) => {
    setExpandedStrengths(prev => 
      prev.includes(strength)
        ? prev.filter(s => s !== strength)
        : [...prev, strength]
    );
  };

  const toggleType = (type: string) => {
    setExpandedTypes(prev => 
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const addProductToQuote = async (recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) {
      console.error('Recipe not found');
      return;
    }

    try {
      // Check if product already exists in quote
      const existingProduct = quoteProducts.find(p => p.recipe.id === recipeId);
      if (existingProduct) {
        alert('This product is already in the quote');
        return;
      }

      // Get recipe details for price calculation
      const { data: recipeDetails } = await recipeService.getRecipeById(recipeId);
      const materials = recipeDetails?.recipe_versions[0]?.materials || [];

      const basePrice = await calculateBasePrice(recipeId, materials);
      const newProduct: QuoteProduct = {
        recipe,
        basePrice,
        volume: 1,
        profitMargin: 0.04, // Minimum 4% margin
        finalPrice: Math.ceil((basePrice * 1.04) / 5) * 5 // Round to nearest 5
        // Pump service is now handled at the quote level, not per product
      };

      setQuoteProducts([...quoteProducts, newProduct]);
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Could not add product. Please verify recipe data.');
    }
  };

  const updateProductDetails = (index: number, updates: Partial<QuoteProduct>) => {
    const updatedProducts = [...quoteProducts];
    const currentProduct = updatedProducts[index];
    
    // Merge updates
    const newProduct = { ...currentProduct, ...updates };
    
    // If base price or profit margin is updated, recalculate final price
    if ('basePrice' in updates || 'profitMargin' in updates) {
      const basePrice = updates.basePrice ?? currentProduct.basePrice;
      const profitMargin = updates.profitMargin ?? currentProduct.profitMargin;
      
      // Calculate final price: round up to nearest 5 after applying profit margin
      const finalPrice = Math.ceil((basePrice * (1 + profitMargin)) / 5) * 5;
      
      newProduct.finalPrice = finalPrice;
    }
    
    updatedProducts[index] = newProduct;
    setQuoteProducts(updatedProducts);
  };

  const removeProductFromQuote = (index: number) => {
    setQuoteProducts(quoteProducts.filter((_, i) => i !== index));
  };

  const validateQuote = () => {
    if (!selectedClient) {
      alert('Por favor, seleccione un cliente');
      return false;
    }

    if (quoteProducts.length === 0) {
      alert('Por favor, agregue al menos un producto a la cotización');
      return false;
    }

    if (!constructionSite) {
      alert('Por favor, ingrese el sitio de construcción');
      return false;
    }

    if (!location) {
      alert('Por favor, ingrese la ubicación');
      return false;
    }

    if (!validityDate) {
      alert('Por favor, seleccione la fecha de validez');
      return false;
    }

    if (includePumpService && (!pumpServicePrice || pumpServicePrice <= 0)) {
      alert('Por favor, ingrese un precio válido para el servicio de bombeo');
      return false;
    }

    return true;
  };

  const saveQuote = async () => {
    if (!validateQuote()) return;

    try {
      setIsLoading(true);
      
      // Generate quote number (simple implementation, you might want a more robust method)
      const currentYear = new Date().getFullYear();
      const quoteNumberPrefix = `COT-${currentYear}`;

      // Create quote
      const quoteData = {
        client_id: selectedClient,
        construction_site: constructionSite,
        location: location,
        validity_date: validityDate,
        status: 'DRAFT',
        quote_number: `${quoteNumberPrefix}-${Math.floor(Math.random() * 9000) + 1000}`, // Generate 4-digit random number
        details: [] // Adding empty details array to match CreateQuoteData interface
      };

      const createdQuote = await createQuote(quoteData);

      // Preparar detalles de la cotización de forma más eficiente, sin múltiples llamadas anidadas a la API
      // Mapear todos los productos a detalles para una sola operación de inserción
      const quoteDetailsData = quoteProducts.map(product => {
        // Calcular precio final y monto total una sola vez
        const finalPrice = Math.ceil((product.basePrice * (1 + product.profitMargin)) / 5) * 5;
        const totalAmount = finalPrice * product.volume;

        return {
          quote_id: createdQuote.id,
          recipe_id: product.recipe.id,
          volume: product.volume,
          base_price: product.basePrice,
          profit_margin: product.profitMargin * 100, // Convertir a porcentaje para almacenamiento
          final_price: finalPrice,
          total_amount: totalAmount,
          pump_service: includePumpService,
          pump_price: includePumpService ? pumpServicePrice : null,
          includes_vat: includesVAT
        };
      });

      // Insertar todos los detalles en una sola operación para mayor eficiencia
      const { data: insertedDetails, error: detailsError } = await supabase
        .from('quote_details')
        .insert(quoteDetailsData);

      if (detailsError) {
        console.error('Error inserting quote details:', detailsError);
        throw new Error(`Error al guardar detalles de cotización: ${detailsError.message}`);
      }

      // Mostrar mensaje de éxito
      alert(`Cotización ${createdQuote.quote_number} guardada exitosamente`);
      
      // Limpiar formulario
      setSelectedClient('');
      setQuoteProducts([]);
      setConstructionSite('');
      setLocation('');
      setValidityDate('');
      setClientHistory([]);
      setIncludePumpService(false);
      setPumpServicePrice(0);
      setIncludesVAT(false);

      return createdQuote;
    } catch (error) {
      console.error('Error al guardar la cotización:', error);
      alert('Error al guardar la cotización: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Modify the grouping logic
  const groupedRecipes = recipes.reduce((acc, recipe) => {
    const type = recipe.recipe_type || 'N/A';
    const strength = recipe.strength_fc;
    const slump = recipe.slump;
    
    if (!acc[type]) acc[type] = {};
    if (!acc[type][strength]) acc[type][strength] = {};
    if (!acc[type][strength][slump]) acc[type][strength][slump] = [];
    
    acc[type][strength][slump].push(recipe);
    return acc;
  }, {} as Record<string, Record<number, Record<number, Recipe[]>>>);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-min">
      {/* Left Panel: Product Catalog */}
      <div className="lg:col-span-2 bg-white rounded-lg shadow p-6 h-full">
        <h2 className="text-xl font-bold mb-4">Catálogo de Productos</h2>
        <div className="space-y-6">
          {Object.entries(groupedRecipes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([type, strengthGroups]) => {
              const isTypeExpanded = expandedTypes.includes(type);
              const typeName = type === 'FC' ? "Concreto Convencional F'c" : 
                              type === 'MR' ? 'Concreto Módulo de Ruptura Mr' : type;
              
              return (
                <div key={type} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleType(type)}
                    className="w-full p-4 bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
                  >
                    <h3 className="text-lg font-semibold">{typeName}</h3>
                    <svg
                      className={`w-5 h-5 transform transition-transform ${
                        isTypeExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  
                  {isTypeExpanded && (
                    <div className="p-4 space-y-6">
                      {Object.entries(strengthGroups)
                        .sort(([a], [b]) => Number(b) - Number(a))
                        .map(([strengthStr, slumpGroups]) => {
                          const strength = Number(strengthStr);
                          const isStrengthExpanded = expandedStrengths.includes(strength);
                          
                          // Use different label based on recipe type
                          const strengthLabel = type === 'MR' ? 'MR' : 'f\'c';
                          
                          return (
                            <div key={strength} className="border rounded-lg overflow-hidden mb-4">
                              <button
                                onClick={() => toggleStrength(strength)}
                                className="w-full p-3 bg-gray-100 hover:bg-gray-200 flex justify-between items-center"
                              >
                                <h4 className="font-medium">{strengthLabel}: {strength} kg/cm²</h4>
                                <svg
                                  className={`w-4 h-4 transform transition-transform ${
                                    isStrengthExpanded ? 'rotate-180' : ''
                                  }`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                              </button>
                              
                              {isStrengthExpanded && (
                                <div className="p-3 space-y-4">
                                  {Object.entries(slumpGroups)
                                    .sort(([a], [b]) => Number(b) - Number(a))
                                    .map(([slumpStr, slumpRecipes]) => (
                                      <div key={slumpStr} className="space-y-3">
                                        <h5 className="font-medium text-gray-600">
                                          Revenimiento: {slumpStr} cm
                                        </h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                          {slumpRecipes.map(recipe => (
                                            <div key={recipe.id} className="border rounded p-4">
                                              <h3 className="font-semibold">{recipe.recipe_code}</h3>
                                              <div className="text-sm space-y-1 mt-2">
                                                <p>Tamaño máximo agregado: {recipe.max_aggregate_size} mm</p>
                                                <p>Revenimiento: {recipe.slump} cm</p>
                                                <p>Colocación: {recipe.placement_type === 'D' ? 'Directa' : 'Bombeado'}</p>
                                              </div>
                                              <button 
                                                onClick={() => addProductToQuote(recipe.id)}
                                                className="mt-2 w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 transition-colors"
                                                disabled={isLoading}
                                              >
                                                Agregar a Cotización
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Right Panel: Client Selection and History */}
      <div className="bg-white rounded-lg shadow p-6 flex flex-col h-full">
        <h2 className="text-xl font-bold mb-4">Seleccionar Cliente</h2>
        <select 
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          className="w-full mb-4 p-2 border rounded"
          disabled={isLoading}
        >
          <option value="">Seleccionar Cliente</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>
              {client.business_name} ({client.client_code})
            </option>
          ))}
        </select>

        <div className="mb-4">
          <label className="block mb-2">Obra</label>
          <input 
            type="text"
            value={constructionSite}
            onChange={(e) => setConstructionSite(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Nombre del sitio"
            disabled={isLoading}
          />
        </div>

        <div className="mb-4">
          <label className="block mb-2">Ubicación</label>
          <input 
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Dirección o coordenadas"
            disabled={isLoading}
          />
        </div>

        <div className="mb-4">
          <div className="flex items-center mb-2">
            <input
              type="checkbox"
              id="includePumpService"
              checked={includePumpService}
              onChange={(e) => setIncludePumpService(e.target.checked)}
              className="mr-2 h-4 w-4"
              disabled={isLoading}
            />
            <label htmlFor="includePumpService" className="text-sm font-medium">
              Incluir Servicio de Bombeo para toda la cotización
            </label>
          </div>
          
          {includePumpService && (
            <div className="mt-2">
              <label className="block mb-2 text-sm">Precio del Servicio de Bombeo (toda la cotización)</label>
              <input
                type="number"
                value={pumpServicePrice}
                onChange={(e) => setPumpServicePrice(Number(e.target.value))}
                className="w-full p-2 border rounded"
                placeholder="Precio del servicio"
                min="0"
                disabled={isLoading}
              />
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center mb-2">
            <input
              type="checkbox"
              id="includesVAT"
              checked={includesVAT}
              onChange={(e) => setIncludesVAT(e.target.checked)}
              className="mr-2 h-4 w-4"
              disabled={isLoading}
            />
            <label htmlFor="includesVAT" className="text-sm font-medium">
              Incluir IVA en la cotización
            </label>
          </div>
        </div>

        <div className="mb-4">
          <label className="block mb-2">Fecha de Validez</label>
          <input 
            type="date"
            value={validityDate}
            onChange={(e) => setValidityDate(e.target.value)}
            className="w-full p-2 border rounded"
            disabled={isLoading}
          />
        </div>

        <h3 className="font-semibold mb-2">Historial Reciente</h3>
        <div className="flex-1 overflow-y-auto mb-4">
          {clientHistory.length > 0 ? (
            clientHistory.slice(0, 10).map((item, index) => (
              <div key={index} className="border-b py-2">
                <p>
                  {item.quote_details[0]?.product?.recipe_code || 'Sin tipo'} - 
                  ${item.quote_details[0]?.final_price 
                    ? item.quote_details[0].final_price.toLocaleString('es-MX', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      }) 
                    : '0.00'}
                  {item.delivery_date && ` - ${new Date(item.delivery_date).toLocaleDateString()}`}
                </p>
                {item.delivery_site && (
                  <p className="text-sm text-gray-600">
                    Sitio: {item.delivery_site} ({item.location})
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center">Sin historial de pedidos</p>
          )}
        </div>

        <div className="flex justify-end mt-auto">
          <button 
            onClick={saveQuote}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition-colors"
            disabled={isLoading}
          >
            {isLoading ? 'Guardando...' : 'Guardar Cotización'}
          </button>
        </div>
      </div>

      {/* Bottom Panel: Quote Products */}
      {quoteProducts.length > 0 && (
        <div className="lg:col-span-3 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Productos de la Cotización</h2>
          {quoteProducts.map((product, index) => (
            <div key={index} className="grid grid-cols-6 gap-4 items-center mb-4 pb-4 border-b">
              <div>
                <p className="font-semibold">{product.recipe.recipe_code}</p>
              </div>
              <div>
                <label className="block text-sm">Volumen</label>
                <input 
                  type="number" 
                  value={product.volume} 
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    updateProductDetails(index, { 
                      volume: isNaN(value) ? 1 : value 
                    });
                  }}
                  className="w-full p-2 border rounded"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm">Precio Base</label>
                <input 
                  type="number" 
                  value={product.basePrice} 
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    updateProductDetails(index, { 
                      basePrice: isNaN(value) ? 0 : value 
                    });
                  }}
                  className="w-full p-2 border rounded"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm">Margen (%)</label>
                <input 
                  type="number"
                  step="0.1"
                  value={product.profitMargin * 100}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value)) {
                      updateProductDetails(index, { 
                        profitMargin: value / 100 
                      });
                    }
                  }}
                  onBlur={() => {
                    // Round to 1 decimal and ensure minimum 4%
                    const current = product.profitMargin * 100;
                    const rounded = Math.round(current * 10) / 10;
                    const clamped = Math.max(4, rounded);
                    updateProductDetails(index, { 
                      profitMargin: clamped / 100 
                    });
                  }}
                  placeholder="4.0"
                  className="w-full p-2 border rounded"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm">Precio Final</label>
                <p className="font-semibold">
                  $ {product.finalPrice.toLocaleString('es-MX', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                </p>
              </div>
              <div>
                <button 
                  onClick={() => removeProductFromQuote(index)}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
                  disabled={isLoading}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-center">Procesando...</p>
          </div>
        </div>
      )}
    </div>
  );
}