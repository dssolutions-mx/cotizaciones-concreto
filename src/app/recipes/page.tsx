'use client';

import React from 'react';
import { RecipeList } from '@/components/recipes/RecipeList';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import RoleIndicator from '@/components/ui/RoleIndicator';

export default function RecipesPage() {
  const { hasRole } = useAuth();

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Recetas de Concreto</h1>
        
        <div className="flex items-center gap-3">
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