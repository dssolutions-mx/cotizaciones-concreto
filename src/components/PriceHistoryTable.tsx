/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { ClientPriceData, RecipePriceData, PriceEntry } from '@/types/priceHistory';

interface PriceHistoryTableProps {
  data: ClientPriceData[] | RecipePriceData[];
  groupBy: 'client' | 'recipe';
}

// Helper function to group prices by construction site
const groupByConstructionSite = (recipes: any[]) => {
  const constructionSites = new Map<string, any[]>();
  
  recipes.forEach(recipe => {
    const prices = recipe.prices || [];
    
    // Group prices by construction site
    prices.forEach((price: PriceEntry) => {
      const site = price.construction_site || 'Sin ubicación';
      if (!constructionSites.has(site)) {
        constructionSites.set(site, []);
      }
      
      // Check if we already have this recipe for this site
      const siteRecipes = constructionSites.get(site)!;
      let siteRecipe = siteRecipes.find(r => r.recipeId === recipe.recipeId);
      
      if (!siteRecipe) {
        siteRecipe = {
          ...recipe,
          prices: []
        };
        siteRecipes.push(siteRecipe);
      }
      
      siteRecipe.prices.push(price);
    });
  });
  
  return Array.from(constructionSites.entries()).map(([site, recipes]) => ({
    constructionSite: site,
    recipes
  }));
};

// Helper function to group client prices by construction site
const groupClientPricesByConstructionSite = (client: any) => {
  const constructionSites = new Map<string, PriceEntry[]>();
  
  const prices = client.prices || [];
  
  // Group prices by construction site
  prices.forEach((price: PriceEntry) => {
    const site = price.construction_site || 'Sin ubicación';
    if (!constructionSites.has(site)) {
      constructionSites.set(site, []);
    }
    
    constructionSites.get(site)!.push(price);
  });
  
  return Array.from(constructionSites.entries()).map(([site, prices]) => ({
    constructionSite: site,
    prices
  }));
};

// Helper function to calculate average price for a recipe
const calculateAveragePrice = (data: ClientPriceData[] | RecipePriceData[], recipeId: string) => {
  let activePrices: PriceEntry[] = [];
  
  if ('businessName' in data[0]) {
    // Data is grouped by client
    (data as ClientPriceData[]).forEach(client => {
      client.recipes.forEach(recipe => {
        if (recipe.recipeId === recipeId) {
          const activeRecipePrices = recipe.prices.filter(p => p.is_active);
          activePrices = [...activePrices, ...activeRecipePrices];
        }
      });
    });
  } else {
    // Data is grouped by recipe
    const recipe = (data as RecipePriceData[]).find(r => r.recipeId === recipeId);
    if (recipe) {
      recipe.clients.forEach(client => {
        const activeClientPrices = client.prices.filter(p => p.is_active);
        activePrices = [...activePrices, ...activeClientPrices];
      });
    }
  }
  
  if (activePrices.length === 0) return null;
  
  const sum = activePrices.reduce((acc, price) => acc + price.base_price, 0);
  return sum / activePrices.length;
};

export const PriceHistoryTable: React.FC<PriceHistoryTableProps> = ({ data, groupBy }) => {
  const { profile } = useAuth();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  // Calculate average prices for all recipes
  const averagePrices = useMemo(() => {
    const priceMap = new Map<string, number | null>();
    
    if ('businessName' in data[0]) {
      // Data is grouped by client
      (data as ClientPriceData[]).forEach(client => {
        client.recipes.forEach(recipe => {
          if (!priceMap.has(recipe.recipeId)) {
            priceMap.set(recipe.recipeId, calculateAveragePrice(data, recipe.recipeId));
          }
        });
      });
    } else {
      // Data is grouped by recipe
      (data as RecipePriceData[]).forEach(recipe => {
        priceMap.set(recipe.recipeId, calculateAveragePrice(data, recipe.recipeId));
      });
    }
    
    return priceMap;
  }, [data]);

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

  const toggleSite = (clientId: string, site: string) => {
    const compositeId = `${clientId}-${site}`;
    setExpandedSites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(compositeId)) {
        newSet.delete(compositeId);
      } else {
        newSet.add(compositeId);
      }
      return newSet;
    });
  };

  const toggleClient = (recipeId: string, clientId: string) => {
    const compositeId = `${recipeId}-${clientId}`;
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(compositeId)) {
        newSet.delete(compositeId);
      } else {
        newSet.add(compositeId);
      }
      return newSet;
    });
  };

  const getLatestPrice = (prices: PriceEntry[]) => {
    if (!prices || prices.length === 0) return null;
    
    const activePrices = prices.filter(p => p.is_active);
    if (activePrices.length > 0) {
      return activePrices.sort((a, b) => {
        const dateA = new Date(a.effective_date);
        const dateB = new Date(b.effective_date);
        return dateB.getTime() - dateA.getTime();
      })[0];
    }
    return prices.sort((a, b) => {
      const dateA = new Date(a.effective_date);
      const dateB = new Date(b.effective_date);
      return dateB.getTime() - dateA.getTime();
    })[0];
  };

  const calculatePriceChange = (price: number, recipeId: string) => {
    const avgPrice = averagePrices.get(recipeId);
    if (!avgPrice) return null;
    
    const difference = price - avgPrice;
    const percentage = ((difference / avgPrice) * 100);
    
    return {
      amount: difference,
      percentage: percentage
    };
  };

  // Mobile-specific card component
  const MobilePriceCard = ({ 
    mainName, 
    subItems, 
    isClient, 
    mainId 
  }: { 
    mainName: string, 
    subItems: any[], 
    isClient: boolean, 
    mainId: string 
  }) => {
    // Group sub-items by construction site
    const groupedSubItems = useMemo(() => {
      const siteMap = new Map<string, any[]>();

      subItems.forEach(subItem => {
        const subItemPrices = 'prices' in subItem ? subItem.prices : [];
        
        subItemPrices.forEach((price: PriceEntry) => {
          const site = price.construction_site || 'Sin ubicación';
          
          if (!siteMap.has(site)) {
            siteMap.set(site, []);
          }
          
          // Check if this subItem is already in the site group
          const siteGroup = siteMap.get(site)!;
          const existingSubItem = siteGroup.find(item => 
            (isClient 
              ? item.recipeId === subItem.recipeId 
              : item.clientId === subItem.clientId)
          );
          
          if (!existingSubItem) {
            siteGroup.push(subItem);
          }
        });
      });

      // Convert map to array of site groups
      return Array.from(siteMap.entries()).map(([site, items]) => ({
        constructionSite: site,
        items
      }));
    }, [subItems, isClient]);

    return (
      <div className="bg-white shadow-md rounded-lg mb-4 overflow-hidden">
        {/* Header */}
        <div className="bg-primary/10 p-3 flex justify-between items-center">
          <h3 className="font-semibold text-sm">{mainName}</h3>
          <span className="text-xs text-gray-500">
            {subItems.length} {isClient 
              ? (subItems.length === 1 ? 'receta' : 'recetas') 
              : (subItems.length === 1 ? 'cliente' : 'clientes')}
          </span>
        </div>

        {/* Expandable content */}
        {expandedRows.has(mainId) && (
          <div className="p-3 space-y-4">
            {groupedSubItems.map((siteGroup, siteIndex) => (
              <div 
                key={`${mainId}-site-${siteIndex}`} 
                className="bg-gray-50 rounded-lg p-3 shadow-sm"
              >
                {/* Construction Site Header */}
                <div className="flex justify-between items-center mb-3 border-b pb-2">
                  <h4 className="font-semibold text-sm text-primary">
                    {siteGroup.constructionSite}
                  </h4>
                  <span className="text-xs text-gray-500">
                    {siteGroup.items.length} {siteGroup.items.length === 1 
                      ? (isClient ? 'receta' : 'cliente') 
                      : (isClient ? 'recetas' : 'clientes')}
                  </span>
                </div>

                {/* Items within this construction site */}
                <div className="space-y-3">
                  {siteGroup.items.map((subItem, itemIndex) => {
                    const subId = isClient 
                      ? (subItem as { recipeId: string }).recipeId 
                      : (subItem as { clientId: string }).clientId;
                    const subName = isClient 
                      ? (subItem as { recipeCode: string }).recipeCode 
                      : (subItem as { businessName: string }).businessName;
                    const prices = 'prices' in subItem ? subItem.prices : [];
                    
                    // Filter prices for this specific construction site
                    const sitePrices = prices.filter((p: PriceEntry) => 
                      p.construction_site === siteGroup.constructionSite
                    );
                    
                    const latestPrice = getLatestPrice(sitePrices);
                    
                    // Determine the correct recipeId for price comparison
                    const recipeId = isClient 
                      ? subId 
                      : (groupBy === 'recipe' 
                          ? mainId  // For recipe view, use the main recipe ID
                          : subId   // For client view, use the client's recipe ID
                        );
                    
                    const priceChange = latestPrice ? 
                      calculatePriceChange(latestPrice.base_price, recipeId) : null;

                    return (
                      <div 
                        key={`${mainId}-${siteGroup.constructionSite}-${subId}`} 
                        className="bg-white rounded-lg p-3 shadow-sm"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <h5 className="font-medium text-sm">{subName}</h5>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="block text-xs text-gray-600">Precio Actual</span>
                            <p className="font-semibold text-sm">
                              {latestPrice ? formatCurrency(latestPrice.base_price) : '-'}
                            </p>
                          </div>
                          <div>
                            <span className="block text-xs text-gray-600">Diferencia</span>
                            <p className={`font-semibold text-sm ${
                              priceChange?.amount && priceChange.amount >= 0 
                                ? 'text-green-600' 
                                : 'text-red-600'
                            }`}>
                              {priceChange 
                                ? `${formatCurrency(priceChange.amount)} (${priceChange.percentage.toFixed(1)}%)` 
                                : '-'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 flex justify-between items-center">
                          <span className="text-xs text-gray-500">
                            {latestPrice 
                              ? `Actualizado: ${formatDate(new Date(latestPrice.effective_date))}` 
                              : 'Sin fecha'}
                          </span>
                          {latestPrice?.is_active && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              Activo
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Expand/Collapse Toggle */}
        <button 
          onClick={() => toggleRow(mainId)}
          className="w-full bg-gray-100 hover:bg-gray-200 text-center py-2 text-sm font-medium transition-colors"
        >
          {expandedRows.has(mainId) ? 'Ocultar Detalles' : 'Ver Detalles'}
        </button>
      </div>
    );
  };

  if (!data || data.length === 0) {
    return <div className="p-4 text-center">No hay datos de historial de precios disponibles.</div>;
  }

  return (
    <div>
      <div className="mb-4">
        <Select
          value={selectedFilter}
          onValueChange={value => setSelectedFilter(value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={`Filtrar por ${groupBy === 'client' ? 'receta' : 'cliente'}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mostrar todo</SelectItem>
            {/* Add filter options based on your data */}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-primary/10">
              <TableHead className="w-10 p-2 sm:p-4"></TableHead>
              <TableHead className="p-2 sm:p-4">{groupBy === 'client' ? 'Cliente' : 'Receta'}</TableHead>
              <TableHead className="p-2 sm:p-4 hidden sm:table-cell">Obra</TableHead>
              <TableHead className="p-2 sm:p-4">{groupBy === 'client' ? 'Receta' : 'Cliente'}</TableHead>
              <TableHead className="text-right p-2 sm:p-4 hidden sm:table-cell">Precio Actual</TableHead>
              <TableHead className="text-right p-2 sm:p-4 hidden md:table-cell">Diferencia con Promedio</TableHead>
              <TableHead className="p-2 sm:p-4 hidden sm:table-cell">Última Actualización</TableHead>
              <TableHead className="p-2 sm:p-4 hidden sm:table-cell">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item: ClientPriceData | RecipePriceData) => {
              const isClient = 'businessName' in item;
              const mainId = isClient ? item.clientId : item.recipeId;
              const mainName = isClient ? item.businessName : item.recipeCode;
              
              // For client view, group by construction site
              if (isClient && groupBy === 'client') {
                const clientItem = item as ClientPriceData;
                const constructionSites = groupByConstructionSite(clientItem.recipes);
                
                return (
                  <React.Fragment key={mainId}>
                    {/* Main client row */}
                    <TableRow 
                      className="cursor-pointer hover:bg-primary/5"
                      onClick={() => toggleRow(mainId)}
                    >
                      <TableCell>
                        {expandedRows.has(mainId) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{mainName}</TableCell>
                      <TableCell>
                        {constructionSites.length} {constructionSites.length === 1 ? 'obra' : 'obras'}
                      </TableCell>
                      <TableCell colSpan={5}></TableCell>
                    </TableRow>

                    {/* Construction site rows */}
                    {expandedRows.has(mainId) && constructionSites.map(site => {
                      const siteId = `${mainId}-${site.constructionSite}`;
                      
                      return (
                        <React.Fragment key={siteId}>
                          <TableRow 
                            className="cursor-pointer bg-muted/30 hover:bg-primary/5"
                            onClick={() => toggleSite(mainId, site.constructionSite)}
                          >
                            <TableCell></TableCell>
                            <TableCell className="font-medium">
                              {site.constructionSite}
                            </TableCell>
                            <TableCell>
                              {site.recipes.length} {site.recipes.length === 1 ? 'receta' : 'recetas'}
                            </TableCell>
                            <TableCell colSpan={5}></TableCell>
                          </TableRow>

                          {/* Recipe rows for this site */}
                          {expandedSites.has(siteId) && site.recipes.map(recipe => {
                            const latestPrice = getLatestPrice(recipe.prices);
                            const priceChange = latestPrice ? 
                              calculatePriceChange(latestPrice.base_price, recipe.recipeId) : null;
                            
                            return (
                              <TableRow 
                                key={`${siteId}-${recipe.recipeId}`}
                                className="bg-muted/50"
                              >
                                <TableCell></TableCell>
                                <TableCell>{recipe.recipeCode}</TableCell>
                                <TableCell>
                                  {latestPrice?.construction_site || '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {latestPrice ? formatCurrency(latestPrice.base_price) : '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {priceChange ? (
                                    <span className={priceChange.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                                      {formatCurrency(priceChange.amount)} ({priceChange.percentage.toFixed(1)}%)
                                    </span>
                                  ) : '-'}
                                </TableCell>
                                <TableCell>
                                  {latestPrice ? formatDate(new Date(latestPrice.effective_date)) : '-'}
                                </TableCell>
                                <TableCell>
                                  {latestPrice?.is_active && (
                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                      Activo
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              } else if (!isClient && groupBy === 'recipe') {
                // Recipe view with construction sites
                const recipeItem = item as RecipePriceData;
                
                return (
                  <React.Fragment key={mainId}>
                    {/* Main recipe row */}
                    <TableRow 
                      className="cursor-pointer hover:bg-primary/5"
                      onClick={() => toggleRow(mainId)}
                    >
                      <TableCell>
                        {expandedRows.has(mainId) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{mainName}</TableCell>
                      <TableCell>
                        {recipeItem.clients.length} {recipeItem.clients.length === 1 ? 'cliente' : 'clientes'}
                      </TableCell>
                      <TableCell colSpan={5}></TableCell>
                    </TableRow>

                    {/* Client rows */}
                    {expandedRows.has(mainId) && recipeItem.clients.map(client => {
                      const clientId = client.clientId;
                      const compositeId = `${mainId}-${clientId}`;
                      
                      // Group client prices by construction site
                      const clientSites = groupClientPricesByConstructionSite(client);
                      const totalSites = clientSites.length;
                      
                      return (
                        <React.Fragment key={compositeId}>
                          {/* Client row */}
                          <TableRow 
                            className="cursor-pointer bg-muted/30 hover:bg-primary/5"
                            onClick={() => toggleClient(mainId, clientId)}
                          >
                            <TableCell></TableCell>
                            <TableCell className="font-medium">
                              {client.businessName}
                            </TableCell>
                            <TableCell>
                              {totalSites} {totalSites === 1 ? 'obra' : 'obras'}
                            </TableCell>
                            <TableCell colSpan={4}></TableCell>
                          </TableRow>

                          {/* Construction site rows for this client */}
                          {expandedClients.has(compositeId) && clientSites.map((site, index) => {
                            const latestPrice = getLatestPrice(site.prices);
                            const priceChange = latestPrice ? 
                              calculatePriceChange(latestPrice.base_price, mainId) : null;
                            
                            return (
                              <TableRow 
                                key={`${compositeId}-${site.constructionSite}-${index}`}
                                className="bg-muted/50"
                              >
                                <TableCell></TableCell>
                                <TableCell>{site.constructionSite}</TableCell>
                                <TableCell>
                                  {latestPrice?.construction_site || '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {latestPrice ? formatCurrency(latestPrice.base_price) : '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {priceChange ? (
                                    <span className={priceChange.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                                      {formatCurrency(priceChange.amount)} ({priceChange.percentage.toFixed(1)}%)
                                    </span>
                                  ) : '-'}
                                </TableCell>
                                <TableCell>
                                  {latestPrice ? formatDate(new Date(latestPrice.effective_date)) : '-'}
                                </TableCell>
                                <TableCell>
                                  {latestPrice?.is_active && (
                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                      Activo
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              } else {
                // Fallback view for other scenarios
                const subItems = isClient 
                  ? (item as ClientPriceData).recipes 
                  : (item as RecipePriceData).clients;

                return (
                  <React.Fragment key={mainId}>
                    {/* Main row */}
                    <TableRow 
                      className="cursor-pointer hover:bg-primary/5"
                      onClick={() => toggleRow(mainId)}
                    >
                      <TableCell>
                        {expandedRows.has(mainId) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{mainName}</TableCell>
                      <TableCell>
                        {subItems.length} {isClient 
                          ? (subItems.length === 1 ? 'receta' : 'recetas') 
                          : (subItems.length === 1 ? 'cliente' : 'clientes')}
                      </TableCell>
                      <TableCell colSpan={5}></TableCell>
                    </TableRow>

                    {/* Sub-items */}
                    {expandedRows.has(mainId) && subItems.map(subItem => {
                      const subId = isClient 
                        ? (subItem as { recipeId: string }).recipeId 
                        : (subItem as { clientId: string }).clientId;
                      const subName = isClient 
                        ? (subItem as { recipeCode: string }).recipeCode 
                        : (subItem as { businessName: string }).businessName;
                      const prices = 'prices' in subItem ? subItem.prices : [];
                      const latestPrice = getLatestPrice(prices);
                      const recipeId = isClient ? subId : mainId;
                      const priceChange = latestPrice ? 
                        calculatePriceChange(latestPrice.base_price, recipeId) : null;
                            
                      return (
                        <TableRow 
                          key={`${mainId}-${subId}`}
                          className="bg-muted/50"
                        >
                          <TableCell></TableCell>
                          <TableCell>{subName}</TableCell>
                          <TableCell>{latestPrice?.construction_site || '-'}</TableCell>
                          <TableCell className="text-right">
                            {latestPrice ? formatCurrency(latestPrice.base_price) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {priceChange ? (
                              <span className={priceChange.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency(priceChange.amount)} ({priceChange.percentage.toFixed(1)}%)
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {latestPrice ? formatDate(new Date(latestPrice.effective_date)) : '-'}
                          </TableCell>
                          <TableCell>
                            {latestPrice?.is_active && (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                Activo
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                );
              }
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile-specific card view */}
      <div className="sm:hidden space-y-4">
        {data.map((item: ClientPriceData | RecipePriceData) => {
          const isClient = 'businessName' in item;
          const mainId = isClient ? item.clientId : item.recipeId;
          const mainName = isClient ? item.businessName : item.recipeCode;
          
          const subItems = isClient 
            ? (item as ClientPriceData).recipes 
            : (item as RecipePriceData).clients;

          return (
            <MobilePriceCard
              key={mainId}
              mainName={mainName}
              subItems={subItems}
              isClient={isClient}
              mainId={mainId}
            />
          );
        })}
      </div>
    </div>
  );
}; 