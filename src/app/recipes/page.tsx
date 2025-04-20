'use client';

import React, { useState } from 'react';
import { RecipeList } from '@/components/recipes/RecipeList';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import RoleIndicator from '@/components/ui/RoleIndicator';
import * as XLSX from 'xlsx-js-style';
import { recipeService } from '@/lib/supabase/recipes';
import { calculateBasePrice } from '@/lib/utils/priceCalculator';
import { FileDown } from 'lucide-react';

export default function RecipesPage() {
  const { hasRole } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  const exportRecipeBasePrices = async () => {
    try {
      setIsExporting(true);
      
      // 1. Fetch all active recipes
      const recipesResponse = await recipeService.getRecipes();
      const recipes = recipesResponse.data || [];
      
      // 2. Calculate base price for each recipe
      const recipeData = [];
      for (const recipe of recipes) {
        // Get the current version with materials
        const { data: recipeDetails } = await recipeService.getRecipeById(recipe.id);
        if (!recipeDetails?.recipe_versions?.length) continue;
        
        const currentVersion = recipeDetails.recipe_versions[0];
        const materials = currentVersion.materials || [];
        
        // Calculate base price
        try {
          const basePrice = await calculateBasePrice(recipe.id, materials);
          
          recipeData.push({
            'Código': recipe.recipe_code,
            'Tipo': recipe.recipe_type || 'N/A',
            'Resistencia (kg/cm²)': recipe.strength_fc,
            'Revenimiento (cm)': recipe.slump,
            'Tamaño Máx. Agregado (mm)': recipe.max_aggregate_size,
            'Edad (días)': recipe.age_days || 'N/A',
            'Colocación': recipe.placement_type === 'D' ? 'Directa' : 'Bombeado',
            'Precio Base (MXN)': basePrice,
          });
        } catch (error) {
          console.error(`Error calculando precio para receta ${recipe.recipe_code}:`, error);
        }
      }
      
      // 3. Create Excel workbook
      const worksheet = XLSX.utils.json_to_sheet(recipeData);
      
      // Add header styles
      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "217346" } }, // Excel green
        alignment: { horizontal: "center" }
      };
      
      // Apply styles to header row
      const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        worksheet[cellRef].s = headerStyle;
      }
      
      // Adjust column widths
      const colWidths = [
        { wch: 15 }, // Código
        { wch: 8 },  // Tipo
        { wch: 18 }, // Resistencia
        { wch: 18 }, // Revenimiento
        { wch: 18 }, // Tamaño Máx
        { wch: 12 }, // Edad
        { wch: 12 }, // Colocación
        { wch: 18 }, // Precio Base
      ];
      worksheet['!cols'] = colWidths;
      
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Precios Base');
      
      // 4. Generate Excel file and trigger download
      const currentDate = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Precios_Base_Recetas_${currentDate}.xlsx`);
      
    } catch (error) {
      console.error('Error al exportar recetas:', error);
      alert('Ocurrió un error al exportar los precios de las recetas');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 bg-white rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Recetas de Concreto</h1>
        
        <div className="flex items-center gap-3">
          {/* Export Button */}
          <RoleProtectedButton
            allowedRoles={['QUALITY_TEAM', 'EXECUTIVE']}
            onClick={exportRecipeBasePrices}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 inline-flex items-center gap-2"
            showDisabled={true}
            disabledMessage="Solo el equipo de calidad y ejecutivos pueden exportar precios base"
          >
            <FileDown size={18} />
            {isExporting ? 'Exportando...' : 'Exportar Precios Base'}
          </RoleProtectedButton>
          
          {/* Show upload button only to QUALITY_TEAM and EXECUTIVE */}
          <RoleProtectedButton
            allowedRoles={['QUALITY_TEAM', 'EXECUTIVE']}
            onClick={() => {}} // Link handles the navigation
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 inline-flex items-center"
            showDisabled={true}
            disabledMessage="Solo el equipo de calidad y ejecutivos pueden cargar nuevas recetas"
          >
            <Link href="/recipes/upload">
              Cargar Nueva Receta
            </Link>
          </RoleProtectedButton>
          
          {/* Alternative: Show indicator next to button */}
          {!hasRole(['QUALITY_TEAM', 'EXECUTIVE']) && (
            <RoleIndicator 
              allowedRoles={['QUALITY_TEAM', 'EXECUTIVE']}
              tooltipText="Solo el equipo de calidad y ejecutivos pueden administrar recetas"
            />
          )}
        </div>
      </div>
      
      {/* Pass hasEditPermission prop to RecipeList */}
      <RecipeList hasEditPermission={hasRole(['QUALITY_TEAM', 'EXECUTIVE'])} />
    </div>
  );
} 