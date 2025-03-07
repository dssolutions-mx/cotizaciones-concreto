import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ClientPriceHistory,
  RecipePriceHistory,
  PriceHistoryEntry,
  RecipeInHistory,
  ClientInHistory
} from '@/types/priceHistory';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate, formatPercentage } from '@/lib/formatters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';

interface PriceHistoryTableProps {
  data: ClientPriceHistory[] | RecipePriceHistory[];
  groupBy: 'client' | 'recipe';
}

// Función para filtrar entradas de historial de precios
// Solo mostrar cotizaciones aprobadas, excepto para el equipo de calidad que no debe ver ninguna
const filterPriceHistory = (entries: PriceHistoryEntry[] | undefined, userRole: string | undefined): PriceHistoryEntry[] => {
  if (!entries || entries.length === 0) return [];
  
  // Filtrar para mostrar solo cotizaciones aprobadas
  return entries.filter(entry => 
    // Incluir solo entradas que tengan una cotización asociada con status approved
    entry.quote?.status === 'APPROVED'
  );
};

// Función para calcular el precio promedio de una receta
const calculateAverageRecipePrice = (data: ClientPriceHistory[] | RecipePriceHistory[], recipeId: string): number => {
  let totalPrice = 0;
  let count = 0;

  if (!data || data.length === 0 || !recipeId) return 0;

  // Si tenemos datos agrupados por cliente
  if (data[0] && 'recipes' in data[0]) {
    const clientData = data as ClientPriceHistory[];
    
    // Recorrer todos los clientes para encontrar la receta específica
    clientData.forEach(client => {
      if (!client.recipes) return;
      const recipe = client.recipes.find(r => r.recipeId === recipeId);
      if (recipe && recipe.priceHistory) {
        // Ya no filtramos, consideramos todos los precios activos
        const activePrices = recipe.priceHistory.filter(p => p.isActive === true);
        
        if (activePrices.length > 0) {
          // Ordenar por fecha más reciente
          activePrices.sort((a, b) => 
            new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
          );
          // Usar el precio activo más reciente
          const activePrice = activePrices[0].base_price;
          if (activePrice && activePrice > 0) {
            totalPrice += activePrice;
            count++;
          }
        }
      }
    });
  } 
  // Si tenemos datos agrupados por receta
  else {
    const recipeData = data as RecipePriceHistory[];
    const recipe = recipeData.find(r => r.recipeId === recipeId);
    
    if (recipe && recipe.clients) {
      recipe.clients.forEach(client => {
        if (!client.priceHistory) return;
        // Ya no filtramos por cotizaciones aprobadas
        const activePrices = client.priceHistory.filter(p => p.isActive === true);
        
        if (activePrices.length > 0) {
          // Ordenar por fecha más reciente
          activePrices.sort((a, b) => 
            new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
          );
          // Usar el precio activo más reciente
          const activePrice = activePrices[0].base_price;
          if (activePrice && activePrice > 0) {
            totalPrice += activePrice;
            count++;
          }
        }
      });
    }
  }

  return count > 0 ? totalPrice / count : 0;
};

// Función para extraer todas las recetas únicas de los datos
const extractUniqueRecipes = (data: ClientPriceHistory[] | RecipePriceHistory[]): { id: string; code: string }[] => {
  const recipeMap = new Map<string, { id: string; code: string }>();
  
  if (!data || data.length === 0) return [];
  
  if ('recipes' in data[0]) {
    // Datos agrupados por cliente
    const clientData = data as ClientPriceHistory[];
    clientData.forEach(client => {
      if (!client.recipes) return;
      client.recipes.forEach(recipe => {
        if (recipe && recipe.recipeId) {
          recipeMap.set(recipe.recipeId, { id: recipe.recipeId, code: recipe.recipeCode });
        }
      });
    });
  } else {
    // Datos agrupados por receta
    const recipeData = data as RecipePriceHistory[];
    recipeData.forEach(recipe => {
      if (recipe && recipe.recipeId) {
        recipeMap.set(recipe.recipeId, { id: recipe.recipeId, code: recipe.recipeCode });
      }
    });
  }
  
  return Array.from(recipeMap.values());
};

// Función para renderizar el historial de precios
const renderPriceHistory = (history: PriceHistoryEntry[], parentKey: string) => {
  if (!history || history.length === 0) return null;
  
  return history.map((entry, index) => (
    <TableRow key={`${parentKey}-price-${entry.id || index}`} className="bg-muted/50">
      <TableCell colSpan={4} />
      <TableCell>{formatDate(entry.effectiveDate)}</TableCell>
      <TableCell>{entry.code}</TableCell>
      <TableCell>{formatCurrency(entry.base_price)}</TableCell>
      <TableCell>{entry.type}</TableCell>
      <TableCell>
        {entry.isActive && (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
            Activo
          </span>
        )}
      </TableCell>
      <TableCell>
        {entry.quoteId && (
          <span className="text-sm text-muted-foreground">
            Cotización #{entry.quoteId}
          </span>
        )}
      </TableCell>
    </TableRow>
  ));
};

// Funciones de utilidad para la comparación de precios
const getComparisonColor = (currentPrice: number, averagePrice: number): string => {
  if (currentPrice === averagePrice) return 'text-gray-600';
  return currentPrice > averagePrice ? 'text-green-600' : 'text-red-600';
};

const getComparisonText = (currentPrice: number, averagePrice: number): string => {
  if (currentPrice === averagePrice) return 'Igual al promedio';
  
  const diff = currentPrice - averagePrice;
  const percentage = averagePrice > 0 ? (diff / averagePrice) * 100 : 0;
  
  return `${formatCurrency(diff)} (${formatPercentage(percentage)})`;
};

// Componente principal
export const PriceHistoryTable: React.FC<PriceHistoryTableProps> = ({ data, groupBy }) => {
  const { userProfile } = useAuth();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedRecipe, setSelectedRecipe] = useState<string>("");
  
  const clientsWithFilteredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    if (groupBy === 'client') {
      return (data as ClientPriceHistory[]).map(client => ({
        ...client,
        recipes: client.recipes.map(recipe => ({
          ...recipe,
          // Filtrar para mostrar solo cotizaciones aprobadas
          priceHistory: filterPriceHistory(recipe.priceHistory, userProfile?.role),
          // Usar el precio más reciente de cotizaciones aprobadas
          currentPrice: recipe.priceHistory?.filter(p => p.isActive && p.quote?.status === 'APPROVED')
            .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime())[0]?.base_price || 0
        }))
      }));
    } else {
      return (data as RecipePriceHistory[]).map(recipe => ({
        ...recipe,
        clients: recipe.clients.map(client => ({
          ...client,
          // Filtrar para mostrar solo cotizaciones aprobadas
          priceHistory: filterPriceHistory(client.priceHistory, userProfile?.role),
          // Usar el precio más reciente de cotizaciones aprobadas
          currentPrice: client.priceHistory?.filter(p => p.isActive && p.quote?.status === 'APPROVED')
            .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime())[0]?.base_price || 0
        }))
      }));
    }
  }, [data, groupBy, userProfile]);
  
  // Obtener recetas únicas para el filtro
  const uniqueRecipes = useMemo(() => {
    return extractUniqueRecipes(clientsWithFilteredData);
  }, [clientsWithFilteredData]);
  
  // Filtrar datos según la receta seleccionada
  const filteredData = useMemo(() => {
    if (!selectedRecipe) return clientsWithFilteredData;
    
    if (groupBy === 'client') {
      return (clientsWithFilteredData as ClientPriceHistory[]).map(client => ({
        ...client,
        recipes: client.recipes?.filter(recipe => recipe.recipeId === selectedRecipe) || []
      })).filter(client => client.recipes && client.recipes.length > 0);
    } else {
      return (clientsWithFilteredData as RecipePriceHistory[]).filter(recipe => recipe.recipeId === selectedRecipe);
    }
  }, [clientsWithFilteredData, selectedRecipe, groupBy]);

  // Manejar la expansión/colapso de filas
  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Manejar el cambio de receta seleccionada
  const handleRecipeChange = (recipeId: string) => {
    setSelectedRecipe(recipeId === 'all' ? "" : recipeId);
  };

  if (!clientsWithFilteredData || clientsWithFilteredData.length === 0) {
    return (
      <div className="p-4 text-center">
        No hay datos de historial de precios disponibles con cotizaciones aprobadas.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-500 italic">
        Nota: Solo se muestran precios de cotizaciones aprobadas
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="w-full md:w-72">
          <Select
            value={selectedRecipe || "all"}
            onValueChange={handleRecipeChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por receta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las recetas</SelectItem>
              {uniqueRecipes.map((recipe) => (
                <SelectItem key={recipe.id} value={recipe.id}>
                  {recipe.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Versión móvil (Cards) */}
      <div className="md:hidden space-y-4">
        {filteredData.length === 0 ? (
          <div className="text-center py-4 bg-gray-50 rounded-md">
            No se encontraron datos que coincidan con el filtro seleccionado.
          </div>
        ) : (
          groupBy === 'client' ? (
            (filteredData as ClientPriceHistory[]).map((client, clientIndex) => {
              const clientKey = `client-${client.clientId}-${clientIndex}`;
              const isClientExpanded = expandedRows.has(clientKey);

              return (
                <div key={clientKey} className="bg-white rounded-md shadow-sm overflow-hidden">
                  <div 
                    className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleRow(clientKey)}
                  >
                    <div className="font-medium">{client.businessName}</div>
                    <div className="text-gray-500">
                      {isClientExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </div>
                  </div>
                  
                  {isClientExpanded && client.recipes && (
                    <div className="border-t border-gray-100">
                      {client.recipes.map((recipe, recipeIndex) => {
                        const recipeKey = `${clientKey}-recipe-${recipe.recipeId}-${recipeIndex}`;
                        const isRecipeExpanded = expandedRows.has(recipeKey);
                        const averagePrice = calculateAverageRecipePrice(data, recipe.recipeId);
                        
                        return (
                          <div key={recipeKey} className="border-t border-gray-100">
                            <div 
                              className="p-4 pl-8 flex flex-col cursor-pointer hover:bg-gray-50"
                              onClick={() => toggleRow(recipeKey)}
                            >
                              <div className="flex justify-between items-center">
                                <div className="font-medium">Receta: {recipe.recipeCode}</div>
                                <div className="text-gray-500">
                                  {isRecipeExpanded ? (
                                    <ChevronDown className="h-5 w-5" />
                                  ) : (
                                    <ChevronRight className="h-5 w-5" />
                                  )}
                                </div>
                              </div>
                              
                              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                <div>Precio actual:</div>
                                <div className="text-right">{formatCurrency(recipe.currentPrice)}</div>
                                
                                <div>Precio promedio:</div>
                                <div className="text-right">{formatCurrency(averagePrice)}</div>
                                
                                <div>Comparación:</div>
                                <div className={`text-right ${getComparisonColor(recipe.currentPrice, averagePrice)}`}>
                                  {getComparisonText(recipe.currentPrice, averagePrice)}
                                </div>
                              </div>
                            </div>
                            
                            {isRecipeExpanded && recipe.priceHistory && (
                              <div className="bg-gray-50 p-4 pl-12">
                                <div className="text-sm font-medium mb-2">Historial de precios:</div>
                                <div className="space-y-2">
                                  {recipe.priceHistory.slice(0, 5).map((entry, historyIndex) => (
                                    <div key={`${recipeKey}-history-${historyIndex}`} className="bg-white p-3 rounded border border-gray-200 text-sm">
                                      <div className="grid grid-cols-2 gap-1">
                                        <div>Fecha:</div>
                                        <div className="text-right">{formatDate(entry.effectiveDate)}</div>
                                        
                                        <div>Precio:</div>
                                        <div className="text-right">{formatCurrency(entry.base_price)}</div>
                                        
                                        <div>Estado:</div>
                                        <div className="text-right">
                                          {entry.isActive ? (
                                            <div className="flex justify-end">
                                              <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                                                Activo
                                              </span>
                                            </div>
                                          ) : (
                                            <div className="flex justify-end">
                                              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                                                Inactivo
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        
                                        {entry.quoteId && (
                                          <>
                                            <div>Cotización:</div>
                                            <div className="text-right">#{entry.quoteId}</div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {recipe.priceHistory.length > 5 && (
                                    <div className="text-center text-sm text-gray-500 mt-2">
                                      Mostrando 5 de {recipe.priceHistory.length} registros
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            (filteredData as RecipePriceHistory[]).map((recipe, recipeIndex) => {
              const recipeKey = `recipe-${recipe.recipeId}-${recipeIndex}`;
              const isRecipeExpanded = expandedRows.has(recipeKey);

              return (
                <div key={recipeKey} className="bg-white rounded-md shadow-sm overflow-hidden">
                  <div 
                    className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleRow(recipeKey)}
                  >
                    <div className="font-medium">{recipe.recipeCode}</div>
                    <div className="text-gray-500">
                      {isRecipeExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </div>
                  </div>
                  
                  {isRecipeExpanded && recipe.clients && (
                    <div className="border-t border-gray-100">
                      {recipe.clients.map((client, clientIndex) => {
                        const clientKey = `${recipeKey}-client-${client.clientId}-${clientIndex}`;
                        const isClientExpanded = expandedRows.has(clientKey);
                        const averagePrice = calculateAverageRecipePrice(data, recipe.recipeId);
                        
                        return (
                          <div key={clientKey} className="border-t border-gray-100">
                            <div 
                              className="p-4 pl-8 flex flex-col cursor-pointer hover:bg-gray-50"
                              onClick={() => toggleRow(clientKey)}
                            >
                              <div className="flex justify-between items-center">
                                <div className="font-medium">Cliente: {client.businessName}</div>
                                <div className="text-gray-500">
                                  {isClientExpanded ? (
                                    <ChevronDown className="h-5 w-5" />
                                  ) : (
                                    <ChevronRight className="h-5 w-5" />
                                  )}
                                </div>
                              </div>
                              
                              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                <div>Precio actual:</div>
                                <div className="text-right">{formatCurrency(client.currentPrice)}</div>
                                
                                <div>Precio promedio:</div>
                                <div className="text-right">{formatCurrency(averagePrice)}</div>
                                
                                <div>Comparación:</div>
                                <div className={`text-right ${getComparisonColor(client.currentPrice, averagePrice)}`}>
                                  {getComparisonText(client.currentPrice, averagePrice)}
                                </div>
                              </div>
                            </div>
                            
                            {isClientExpanded && client.priceHistory && (
                              <div className="bg-gray-50 p-4 pl-12">
                                <div className="text-sm font-medium mb-2">Historial de precios:</div>
                                <div className="space-y-2">
                                  {client.priceHistory.slice(0, 5).map((entry, historyIndex) => (
                                    <div key={`${clientKey}-history-${historyIndex}`} className="bg-white p-3 rounded border border-gray-200 text-sm">
                                      <div className="grid grid-cols-2 gap-1">
                                        <div>Fecha:</div>
                                        <div className="text-right">{formatDate(entry.effectiveDate)}</div>
                                        
                                        <div>Precio:</div>
                                        <div className="text-right">{formatCurrency(entry.base_price)}</div>
                                        
                                        <div>Estado:</div>
                                        <div className="text-right">
                                          {entry.isActive ? (
                                            <div className="flex justify-end">
                                              <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                                                Activo
                                              </span>
                                            </div>
                                          ) : (
                                            <div className="flex justify-end">
                                              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                                                Inactivo
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        
                                        {entry.quoteId && (
                                          <>
                                            <div>Cotización:</div>
                                            <div className="text-right">#{entry.quoteId}</div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {client.priceHistory.length > 5 && (
                                    <div className="text-center text-sm text-gray-500 mt-2">
                                      Mostrando 5 de {client.priceHistory.length} registros
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )
        )}
      </div>

      {/* Versión escritorio (Tabla) */}
      <div className="hidden md:block overflow-x-auto">
        {groupBy === 'client' ? (
          // Vista por cliente
          <Table className="border border-collapse shadow-sm rounded-lg overflow-hidden">
            <TableHeader>
              <TableRow className="bg-primary/10">
                <TableHead className="w-10 border"></TableHead>
                <TableHead className="border font-semibold">Cliente</TableHead>
                <TableHead className="border font-semibold">Obra</TableHead>
                <TableHead className="border font-semibold">Producto</TableHead>
                <TableHead className="border font-semibold text-right">Precio Actual</TableHead>
                <TableHead className="border font-semibold text-right">Precio Promedio</TableHead>
                <TableHead className="border font-semibold text-right">Comparación</TableHead>
                <TableHead className="border font-semibold">Última Actualización</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 border bg-gray-50 text-gray-500">
                    No se encontraron datos que coincidan con el filtro seleccionado.
                  </TableCell>
                </TableRow>
              ) : (
                (filteredData as ClientPriceHistory[]).flatMap((client, clientIndex) => {
                  if (!client.recipes || client.recipes.length === 0) {
                    return (
                      <TableRow key={`client-empty-${clientIndex}`}>
                        <TableCell className="border"></TableCell>
                        <TableCell className="border font-medium">{client.businessName}</TableCell>
                        <TableCell colSpan={6} className="text-center text-gray-500 border">
                          No hay productos disponibles
                        </TableCell>
                      </TableRow>
                    );
                  }

                  // Crear la fila del cliente
                  const clientKey = `client-${client.clientId}-${clientIndex}`;
                  const isClientExpanded = expandedRows.has(clientKey);
                  
                  // Obtener todas las obras (sitios de construcción) de este cliente
                  const clientSites: Record<string, {
                    site: string,
                    entries: (PriceHistoryEntry & { recipeCode?: string; recipeDescription?: string; recipeId?: string })[]
                  }> = {};
                  
                  client.recipes.forEach(recipe => {
                    if (!recipe.priceHistory) return;
                    
                    // Solo considerar entradas de cotizaciones aprobadas
                    recipe.priceHistory.forEach(entry => {
                      // Verificar que el entry tenga una cotización aprobada
                      if (entry.quote?.status !== 'APPROVED') return;
                      
                      const site = entry.construction_site || 'General';
                      
                      // Inicializar el sitio si no existe
                      if (!clientSites[site]) {
                        clientSites[site] = {
                          site,
                          entries: []
                        };
                      }
                      
                      // En esta vista, agregamos información de la receta actual
                      const enrichedEntry = {
                        ...entry,
                        recipeCode: recipe.recipeCode, // Usamos el código de receta del scope actual
                        recipeId: recipe.recipeId // Agregamos también el ID de la receta
                      };
                      
                      clientSites[site].entries.push(enrichedEntry);
                    });
                  });
                  
                  return [
                    // Fila principal del cliente
                    <TableRow 
                      key={clientKey}
                      className={`cursor-pointer transition-colors hover:bg-primary/5 ${isClientExpanded ? 'bg-gray-50' : ''} ${clientIndex === 0 ? 'border-t-2 border-t-primary/20' : ''}`}
                      onClick={() => toggleRow(clientKey)}
                    >
                      <TableCell className="border text-center">
                        <div className="bg-primary/10 rounded-full p-1 inline-flex items-center justify-center transition-colors hover:bg-primary/20">
                          {isClientExpanded ? (
                            <ChevronDown className="h-4 w-4 text-primary/80" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-primary/80" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="border font-medium text-primary-foreground/90">{client.businessName}</TableCell>
                      <TableCell className="border" colSpan={6}>
                        <div className="flex items-center justify-between">
                          <span>{Object.keys(clientSites).length} obras</span>
                          <span className="text-xs text-gray-500 italic">Haga clic para ver detalles</span>
                        </div>
                      </TableCell>
                    </TableRow>,
                    
                    // Si el cliente está expandido, mostrar sus obras
                    ...(isClientExpanded ? Object.entries(clientSites).map(([siteName, siteData], siteIndex) => {
                      const siteKey = `${clientKey}-site-${siteName}-${siteIndex}`;
                      const isSiteExpanded = expandedRows.has(siteKey);
                      
                      // Obtener el precio actual (el activo más reciente)
                      const activeEntries = siteData.entries.filter(entry => entry.isActive);
                      const currentEntry = activeEntries.length > 0 ? activeEntries[0] : siteData.entries[0];
                      const currentPrice = currentEntry?.base_price || 0;
                      const lastUpdated = currentEntry?.effectiveDate;
                      
                      // Calcular el precio promedio para la receta del sitio
                      // Usamos el ID de la receta del primer entry (todos los entries en un sitio deberían ser de la misma receta)
                      const recipeId = siteData.entries.length > 0 ? siteData.entries[0].recipeId : undefined;
                      const averagePrice = recipeId ? calculateAverageRecipePrice(data, recipeId) : 0;
                      
                      return [
                        // Fila de la obra
                        <TableRow 
                          key={siteKey}
                          className={`cursor-pointer hover:bg-gray-100 ${isSiteExpanded ? 'bg-gray-100' : 'bg-gray-50'}`}
                          onClick={() => toggleRow(siteKey)}
                        >
                          <TableCell className="border text-center">
                            <div className="bg-gray-200 rounded-full p-1 inline-flex items-center justify-center transition-colors hover:bg-gray-300 ml-2">
                              {isSiteExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-gray-700" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-gray-700" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="border"></TableCell>
                          <TableCell className="border font-medium pl-4 text-gray-800">{siteName}</TableCell>
                          <TableCell className="border" colSpan={5}>
                            <div className="flex items-center justify-between">
                              <span>{siteData.entries.length} productos</span>
                              <span className="text-xs text-gray-500 italic">Haga clic para ver productos</span>
                            </div>
                          </TableCell>
                        </TableRow>,
                        
                        // Si la obra está expandida, mostrar sus productos
                        ...(isSiteExpanded ? siteData.entries.map((entry, historyIndex) => {
                          const recipeKey = `${siteKey}-entry-${entry.id}-${historyIndex}`;
                          const isRecipeExpanded = expandedRows.has(recipeKey);
                          
                          // Usar el recipeId que agregamos al enriquecer la entrada
                          const entryRecipeId = entry.recipeId;
                          // Calcular el precio promedio para esta receta específica
                          const entryAveragePrice = entryRecipeId ? calculateAverageRecipePrice(data, entryRecipeId) : 0;
                          
                          return (
                            <TableRow 
                              key={recipeKey}
                              className={`transition-colors ${isRecipeExpanded ? 'bg-blue-50' : 'hover:bg-blue-50/50'}`}
                              onClick={() => toggleRow(recipeKey)}
                            >
                              <TableCell className="border text-center">
                                <div className="bg-blue-100 rounded-full p-1 inline-flex items-center justify-center transition-colors hover:bg-blue-200 ml-4">
                                  {isRecipeExpanded ? (
                                    <ChevronDown className="h-3 w-3 text-blue-700" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 text-blue-700" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="border"></TableCell>
                              <TableCell className="border"></TableCell>
                              <TableCell className="border font-medium pl-6 text-blue-900">
                                {entry.recipeCode || entry.code} 
                                <span className="text-xs text-gray-500 italic ml-2">
                                  ({entry.type || 'Estándar'})
                                  {entry.quoteId && ` - Cotización #${entry.quoteId}`}
                                </span>
                              </TableCell>
                              <TableCell className="border font-medium text-right">{formatCurrency(currentPrice)}</TableCell>
                              <TableCell className="border text-right">{formatCurrency(entryAveragePrice)}</TableCell>
                              <TableCell className={`border ${getComparisonColor(currentPrice, entryAveragePrice)} font-medium text-right`}>
                                {getComparisonText(currentPrice, entryAveragePrice)}
                              </TableCell>
                              <TableCell className="border text-gray-600">
                                {lastUpdated ? formatDate(lastUpdated) : "-"}
                              </TableCell>
                            </TableRow>
                          );
                        }) : [])
                      ];
                    }) : [])
                  ];
                })
              )}
            </TableBody>
          </Table>
        ) : (
          // Vista por receta
          <Table className="border border-collapse shadow-sm rounded-lg overflow-hidden">
            <TableHeader>
              <TableRow className="bg-primary/10">
                <TableHead className="w-10 border"></TableHead>
                <TableHead className="border font-semibold">Producto</TableHead>
                <TableHead className="border font-semibold">Cliente</TableHead>
                <TableHead className="border font-semibold">Obra</TableHead>
                <TableHead className="border font-semibold text-right">Precio Actual</TableHead>
                <TableHead className="border font-semibold text-right">Precio Promedio</TableHead>
                <TableHead className="border font-semibold text-right">Comparación</TableHead>
                <TableHead className="border font-semibold">Última Actualización</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 border bg-gray-50 text-gray-500">
                    No se encontraron datos que coincidan con el filtro seleccionado.
                  </TableCell>
                </TableRow>
              ) : (
                (filteredData as RecipePriceHistory[]).flatMap((recipe, recipeIndex) => {
                  if (!recipe.clients || recipe.clients.length === 0) {
                    return (
                      <TableRow key={`recipe-empty-${recipeIndex}`}>
                        <TableCell className="border"></TableCell>
                        <TableCell className="border font-medium">{recipe.recipeCode}</TableCell>
                        <TableCell colSpan={6} className="text-center text-gray-500 border">
                          No hay clientes disponibles
                        </TableCell>
                      </TableRow>
                    );
                  }

                  // Crear la fila del producto
                  const recipeKey = `recipe-${recipe.recipeId}-${recipeIndex}`;
                  const isRecipeExpanded = expandedRows.has(recipeKey);
                  const averagePrice = calculateAverageRecipePrice(data, recipe.recipeId);
                  
                  return [
                    // Fila principal del producto
                    <TableRow 
                      key={recipeKey}
                      className={`cursor-pointer transition-colors hover:bg-primary/5 ${isRecipeExpanded ? 'bg-gray-50' : ''} ${recipeIndex === 0 ? 'border-t-2 border-t-primary/20' : ''}`}
                      onClick={() => toggleRow(recipeKey)}
                    >
                      <TableCell className="border text-center">
                        <div className="bg-primary/10 rounded-full p-1 inline-flex items-center justify-center transition-colors hover:bg-primary/20">
                          {isRecipeExpanded ? (
                            <ChevronDown className="h-4 w-4 text-primary/80" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-primary/80" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="border font-medium text-primary-foreground/90">{recipe.recipeCode}</TableCell>
                      <TableCell className="border" colSpan={6}>
                        <div className="flex items-center justify-between">
                          <span>{recipe.clients.length} clientes utilizan este producto</span>
                          <span className="text-xs text-gray-500 italic">Haga clic para ver clientes</span>
                        </div>
                      </TableCell>
                    </TableRow>,
                    
                    // Si el producto está expandido, mostrar los clientes
                    ...(isRecipeExpanded ? recipe.clients.flatMap((client, clientIndex) => {
                      const clientKey = `${recipeKey}-client-${client.clientId}-${clientIndex}`;
                      const isClientExpanded = expandedRows.has(clientKey);
                      
                      // Obtener todas las obras (sitios de construcción) de este cliente
                      const clientSites: Record<string, {
                        site: string,
                        entries: (PriceHistoryEntry & { recipeCode?: string; recipeDescription?: string; recipeId?: string })[]
                      }> = {};
                      
                      client.priceHistory?.forEach(entry => {
                        // Verificar que el entry tenga una cotización aprobada
                        if (entry.quote?.status !== 'APPROVED') return;
                        
                        const site = entry.construction_site || 'General';
                        
                        // Inicializar el sitio si no existe
                        if (!clientSites[site]) {
                          clientSites[site] = {
                            site,
                            entries: []
                          };
                        }
                        
                        // En esta vista, agregamos información de la receta actual
                        const enrichedEntry = {
                          ...entry,
                          recipeCode: recipe.recipeCode, // Usamos el código de receta del scope actual
                          recipeId: recipe.recipeId // Agregamos también el ID de la receta
                        };
                        
                        clientSites[site].entries.push(enrichedEntry);
                      });
                      
                      return [
                        // Fila del cliente
                        <TableRow 
                          key={clientKey}
                          className={`cursor-pointer transition-colors ${isClientExpanded ? 'bg-gray-100' : 'bg-gray-50 hover:bg-gray-100'}`}
                          onClick={() => toggleRow(clientKey)}
                        >
                          <TableCell className="border text-center">
                            <div className="bg-gray-200 rounded-full p-1 inline-flex items-center justify-center transition-colors hover:bg-gray-300 ml-2">
                              {isClientExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-gray-700" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-gray-700" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="border"></TableCell>
                          <TableCell className="border font-medium pl-4 text-gray-800">{client.businessName}</TableCell>
                          <TableCell className="border">
                            <div className="flex items-center justify-between">
                              <span>{Object.keys(clientSites).length} obras</span>
                              {Object.keys(clientSites).length > 0 && (
                                <span className="text-xs text-gray-500 italic">Haga clic para ver obras</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="border font-medium text-right">{formatCurrency(client.currentPrice)}</TableCell>
                          <TableCell className="border text-right">{formatCurrency(averagePrice)}</TableCell>
                          <TableCell className={`border ${getComparisonColor(client.currentPrice, averagePrice)} font-medium text-right`}>
                            {getComparisonText(client.currentPrice, averagePrice)}
                          </TableCell>
                          <TableCell className="border">
                            {client.priceHistory && client.priceHistory.length > 0 ? formatDate(client.priceHistory[0].effectiveDate) : "-"}
                          </TableCell>
                        </TableRow>,
                        
                        // Si el cliente está expandido, mostrar los sitios
                        ...(isClientExpanded ? Object.entries(clientSites).map(([siteName, siteData], siteIndex) => {
                          const siteKey = `${clientKey}-site-${siteName}-${siteIndex}`;
                          const isSiteExpanded = expandedRows.has(siteKey);
                          
                          // Obtener el precio actual (el activo más reciente)
                          const activeEntries = siteData.entries.filter(entry => entry.isActive);
                          const currentEntry = activeEntries.length > 0 ? activeEntries[0] : siteData.entries[0];
                          const sitePrice = currentEntry?.base_price || 0;
                          
                          return [
                            // Fila de la obra
                            <TableRow 
                              key={siteKey}
                              className={`cursor-pointer transition-colors ${isSiteExpanded ? 'bg-blue-50/70' : 'hover:bg-blue-50/50'}`}
                              onClick={() => toggleRow(siteKey)}
                            >
                              <TableCell className="border text-center">
                                <div className="bg-blue-100 rounded-full p-1 inline-flex items-center justify-center transition-colors hover:bg-blue-200 ml-4">
                                  {isSiteExpanded ? (
                                    <ChevronDown className="h-3 w-3 text-blue-700" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 text-blue-700" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="border"></TableCell>
                              <TableCell className="border"></TableCell>
                              <TableCell className="border font-medium pl-6 text-blue-900">{siteName}</TableCell>
                              <TableCell className="border font-medium text-right">{formatCurrency(sitePrice)}</TableCell>
                              <TableCell className="border text-right">{formatCurrency(averagePrice)}</TableCell>
                              <TableCell className={`border ${getComparisonColor(sitePrice, averagePrice)} font-medium text-right`}>
                                {getComparisonText(sitePrice, averagePrice)}
                              </TableCell>
                              <TableCell className="border">
                                {activeEntries.length > 0 && (
                                  <div className="flex justify-end">
                                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                                      Precio Activo
                                    </span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="border">
                                {currentEntry && (
                                  <div className="flex items-center gap-1">
                                    <span>{formatDate(currentEntry.effectiveDate)}</span>
                                    {isSiteExpanded ? null : <span className="text-xs text-gray-500 italic">Haga clic para más detalles</span>}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>,
                            
                            // Si el sitio está expandido, mostrar las entradas de historial
                            ...(isSiteExpanded ? siteData.entries.map((entry, historyIndex) => (
                              <TableRow key={`${siteKey}-history-${historyIndex}`} className="bg-blue-50/30 hover:bg-blue-50/50 transition-colors">
                                <TableCell className="border"></TableCell>
                                <TableCell className="border"></TableCell>
                                <TableCell className="border"></TableCell>
                                <TableCell className="border text-sm text-gray-600 pl-10">
                                  {entry.recipeCode || entry.code} 
                                  <span className="text-xs text-gray-500 italic ml-2">
                                    ({entry.type || 'Estándar'})
                                    {entry.quoteId && ` - Cotización #${entry.quoteId}`}
                                  </span>
                                </TableCell>
                                <TableCell className="border text-right">{formatCurrency(entry.base_price)}</TableCell>
                                <TableCell className="border text-right">
                                  {entry.recipeId ? formatCurrency(calculateAverageRecipePrice(data, entry.recipeId)) : "-"}
                                </TableCell>
                                <TableCell className="border text-right">
                                  {entry.recipeId ? (
                                    <span className={getComparisonColor(entry.base_price, calculateAverageRecipePrice(data, entry.recipeId))}>
                                      {getComparisonText(entry.base_price, calculateAverageRecipePrice(data, entry.recipeId))}
                                    </span>
                                  ) : "-"}
                                </TableCell>
                                <TableCell className="border">
                                  {entry.isActive ? (
                                    <div className="flex justify-end">
                                      <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                                        Activo
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex justify-end">
                                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                                        Inactivo
                                      </span>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="border">{formatDate(entry.effectiveDate)}</TableCell>
                              </TableRow>
                            )) : [])
                          ];
                        }) : [])
                      ];
                    }) : [])
                  ];
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}; 