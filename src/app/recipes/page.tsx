'use client';

import React, { useState } from 'react';
import { RecipeList } from '@/components/recipes/RecipeList';
import { RecipeSearchModal } from '@/components/recipes/RecipeSearchModal';
import Link from 'next/link';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import RoleIndicator from '@/components/ui/RoleIndicator';
import { Plus, Search, Calculator } from 'lucide-react';
import { AddRecipeModal } from '@/components/recipes/AddRecipeModal';
import { RecipeSearchResult } from '@/types/recipes';
import { buttonVariants } from '@/components/ui/button';

export default function RecipesPage() {
  const { hasRole } = useAuthBridge();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const handleRecipeAdded = () => {
    // This will trigger a refetch in the RecipeList component
    window.location.reload();
  };

  const handleRecipeSearch = (recipe: RecipeSearchResult) => {
    // Handle recipe selection from search
    console.log('Recipe selected from search:', recipe);
    // You can implement navigation to recipe details or other actions here
  };

  return (
    <div className="container mx-auto p-4 bg-white rounded-lg">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold">Recetas de Concreto</h1>
          {!hasRole(['QUALITY_TEAM', 'EXECUTIVE']) && (
            <RoleIndicator 
              allowedRoles={['QUALITY_TEAM', 'EXECUTIVE']}
              tooltipText="Solo el equipo de calidad y ejecutivos pueden administrar recetas"
            />
          )}
        </div>

        {/* Clean action toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Calculadora */}
          <RoleProtectedButton
            allowedRoles={['QUALITY_TEAM', 'EXECUTIVE']}
            onClick={() => {}}
            className={buttonVariants({ variant: 'outline' }) + ' inline-flex items-center gap-2'}
            showDisabled={true}
            disabledMessage="Solo el equipo de calidad y ejecutivos pueden usar la calculadora de mezclas"
          >
            <Link href="/recipes/calculator" className="inline-flex items-center gap-2">
              <Calculator size={16} />
              <span>Calculadora de Mezclas</span>
            </Link>
          </RoleProtectedButton>

          {/* Buscar */}
          <RoleProtectedButton
            allowedRoles={['QUALITY_TEAM', 'EXECUTIVE', 'SALES_AGENT']}
            onClick={() => setIsSearchModalOpen(true)}
            className={buttonVariants({ variant: 'outline' }) + ' inline-flex items-center gap-2'}
            showDisabled={true}
            disabledMessage="Solo usuarios autorizados pueden buscar recetas"
          >
            <Search size={16} />
            <span>Buscar Recetas</span>
          </RoleProtectedButton>

          {/* Agregar receta */}
          <RoleProtectedButton
            allowedRoles={['QUALITY_TEAM', 'EXECUTIVE']}
            onClick={() => setIsModalOpen(true)}
            className={buttonVariants({ variant: 'success' }) + ' inline-flex items-center gap-2'}
            showDisabled={true}
            disabledMessage="Solo el equipo de calidad y ejecutivos pueden agregar recetas"
          >
            <Plus size={16} />
            <span>Agregar Receta</span>
          </RoleProtectedButton>
        </div>
      </div>
      
      {/* Add Recipe Modal */}
      <AddRecipeModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handleRecipeAdded}
      />

      {/* Recipe Search Modal */}
      <RecipeSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onRecipeSelect={handleRecipeSearch}
      />
      
      {/* Pass hasEditPermission prop to RecipeList */}
      <RecipeList hasEditPermission={hasRole(['QUALITY_TEAM', 'EXECUTIVE'])} />
    </div>
  );
} 