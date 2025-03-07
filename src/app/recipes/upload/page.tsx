'use client';

import React from 'react';
import { UploadExcel } from '@/components/recipes/UploadExcel';

export default function RecipeUploadPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Carga de Recetas</h1>
      <UploadExcel />
    </div>
  );
} 