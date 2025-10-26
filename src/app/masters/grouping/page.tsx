'use client';

import React from 'react';
import MasterRecipeGroupingInterface from '@/components/masters/MasterRecipeGroupingInterface';
import { features } from '@/config/featureFlags';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function MasterGroupingPage() {
  if (!features.masterGroupingEnabled) {
    return (
      <div className="p-6">
        <Alert>
          <AlertDescription>
            La interfaz de agrupación de recetas está deshabilitada. Pide a un administrador que active NEXT_PUBLIC_FEATURE_MASTER_GROUPING.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <MasterRecipeGroupingInterface enabled={true} />
    </div>
  );
}


