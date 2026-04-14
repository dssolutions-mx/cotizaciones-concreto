'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import RemisionesProduccionTab from '@/components/remisiones/RemisionesProduccionTab';

export function ProduccionReportTab() {
  return (
    <Card className="border-stone-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Producción y consumo de materiales</CardTitle>
      </CardHeader>
      <CardContent>
        <RemisionesProduccionTab />
      </CardContent>
    </Card>
  );
}
