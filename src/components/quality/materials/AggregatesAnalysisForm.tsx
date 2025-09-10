'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Mountain, 
  FileText, 
  Calculator, 
  CheckCircle, 
  AlertCircle,
  Save,
  Upload
} from 'lucide-react';

interface AggregateAnalysisData {
  // Información general
  sampleId: string;
  plant: string;
  supplier: string;
  materialType: 'arena' | 'grava' | 'piedra';
  sampleDate: string;
  testDate: string;
  
  // Análisis granulométrico
  granulometry: {
    sieve_76mm?: number;
    sieve_64mm?: number;
    sieve_50mm?: number;
    sieve_38mm?: number;
    sieve_25mm?: number;
    sieve_19mm?: number;
    sieve_12_5mm?: number;
    sieve_9_5mm?: number;
    sieve_4_75mm?: number;
    sieve_2_36mm?: number;
    sieve_1_18mm?: number;
    sieve_600um?: number;
    sieve_300um?: number;
    sieve_150um?: number;
    sieve_75um?: number;
    pan?: number;
  };
  
  // Densidad y absorción
  density: {
    bulk_density?: number;
    bulk_density_ssd?: number;
    apparent_density?: number;
    absorption?: number;
  };
  
  // Desgaste Los Angeles
  losAngeles: {
    initial_weight?: number;
    final_weight?: number;
    wear_percentage?: number;
  };
  
  // Sanidad
  sanity: {
    sodium_sulfate_loss?: number;
    magnesium_sulfate_loss?: number;
  };
  
  // Impurezas orgánicas
  organicImpurities: {
    color_standard?: number;
    observations?: string;
  };
  
  // Equivalente de arena (solo para arena)
  sandEquivalent?: {
    clay_reading?: number;
    sand_reading?: number;
    equivalent_percentage?: number;
  };
  
  // Observaciones generales
  observations?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
}

const initialData: AggregateAnalysisData = {
  sampleId: '',
  plant: '',
  supplier: '',
  materialType: 'arena',
  sampleDate: '',
  testDate: '',
  granulometry: {},
  density: {},
  losAngeles: {},
  sanity: {},
  organicImpurities: {},
  status: 'draft'
};

export default function AggregatesAnalysisForm() {
  const [formData, setFormData] = useState<AggregateAnalysisData>(initialData);
  const [activeTab, setActiveTab] = useState('general');

  const updateFormData = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof AggregateAnalysisData],
        [field]: value
      }
    }));
  };

  const updateGeneralData = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateModulusOfFineness = () => {
    const { granulometry } = formData;
    const cumulativeRetained = [
      (granulometry.sieve_4_75mm || 0),
      (granulometry.sieve_4_75mm || 0) + (granulometry.sieve_2_36mm || 0),
      (granulometry.sieve_4_75mm || 0) + (granulometry.sieve_2_36mm || 0) + (granulometry.sieve_1_18mm || 0),
      (granulometry.sieve_4_75mm || 0) + (granulometry.sieve_2_36mm || 0) + (granulometry.sieve_1_18mm || 0) + (granulometry.sieve_600um || 0),
      (granulometry.sieve_4_75mm || 0) + (granulometry.sieve_2_36mm || 0) + (granulometry.sieve_1_18mm || 0) + (granulometry.sieve_600um || 0) + (granulometry.sieve_300um || 0),
      (granulometry.sieve_4_75mm || 0) + (granulometry.sieve_2_36mm || 0) + (granulometry.sieve_1_18mm || 0) + (granulometry.sieve_600um || 0) + (granulometry.sieve_300um || 0) + (granulometry.sieve_150um || 0)
    ];
    
    const sum = cumulativeRetained.reduce((acc, val) => acc + val, 0);
    return (sum / 100).toFixed(2);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mountain className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Análisis de Agregados</h1>
            <p className="text-gray-600">Caracterización completa de materiales pétreos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant={formData.status === 'approved' ? 'default' : 'secondary'}
            className="capitalize"
          >
            {formData.status}
          </Badge>
          <Button variant="outline">
            <Save className="h-4 w-4 mr-2" />
            Guardar Borrador
          </Button>
          <Button>
            <CheckCircle className="h-4 w-4 mr-2" />
            Enviar Análisis
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="granulometry">Granulometría</TabsTrigger>
          <TabsTrigger value="density">Densidad</TabsTrigger>
          <TabsTrigger value="losangeles">Desgaste L.A.</TabsTrigger>
          <TabsTrigger value="sanity">Sanidad</TabsTrigger>
          <TabsTrigger value="additional">Adicionales</TabsTrigger>
        </TabsList>

        {/* Información General */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Información General de la Muestra
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="sampleId">ID de Muestra *</Label>
                  <Input
                    id="sampleId"
                    value={formData.sampleId}
                    onChange={(e) => updateGeneralData('sampleId', e.target.value)}
                    placeholder="Ej: AGR-P1-2024-001"
                  />
                </div>
                <div>
                  <Label htmlFor="plant">Planta *</Label>
                  <Select value={formData.plant} onValueChange={(value) => updateGeneralData('plant', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar planta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="P1">Planta 1</SelectItem>
                      <SelectItem value="P2">Planta 2</SelectItem>
                      <SelectItem value="P3">Planta 3</SelectItem>
                      <SelectItem value="P4">Planta 4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="materialType">Tipo de Material *</Label>
                  <Select value={formData.materialType} onValueChange={(value) => updateGeneralData('materialType', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="arena">Arena</SelectItem>
                      <SelectItem value="grava">Grava</SelectItem>
                      <SelectItem value="piedra">Piedra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplier">Proveedor *</Label>
                  <Input
                    id="supplier"
                    value={formData.supplier}
                    onChange={(e) => updateGeneralData('supplier', e.target.value)}
                    placeholder="Nombre del proveedor"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="sampleDate">Fecha de Muestreo</Label>
                    <Input
                      id="sampleDate"
                      type="date"
                      value={formData.sampleDate}
                      onChange={(e) => updateGeneralData('sampleDate', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="testDate">Fecha de Ensayo</Label>
                    <Input
                      id="testDate"
                      type="date"
                      value={formData.testDate}
                      onChange={(e) => updateGeneralData('testDate', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Análisis Granulométrico */}
        <TabsContent value="granulometry" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Análisis Granulométrico
                <Badge variant="outline" className="ml-auto">
                  Módulo de Finura: {calculateModulusOfFineness()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {formData.materialType !== 'arena' && (
                    <>
                      <div>
                        <Label>Tamiz 76 mm (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.granulometry.sieve_76mm || ''}
                          onChange={(e) => updateFormData('granulometry', 'sieve_76mm', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>Tamiz 64 mm (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.granulometry.sieve_64mm || ''}
                          onChange={(e) => updateFormData('granulometry', 'sieve_64mm', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>Tamiz 50 mm (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.granulometry.sieve_50mm || ''}
                          onChange={(e) => updateFormData('granulometry', 'sieve_50mm', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>Tamiz 38 mm (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.granulometry.sieve_38mm || ''}
                          onChange={(e) => updateFormData('granulometry', 'sieve_38mm', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>Tamiz 25 mm (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.granulometry.sieve_25mm || ''}
                          onChange={(e) => updateFormData('granulometry', 'sieve_25mm', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>Tamiz 19 mm (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.granulometry.sieve_19mm || ''}
                          onChange={(e) => updateFormData('granulometry', 'sieve_19mm', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>Tamiz 12.5 mm (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.granulometry.sieve_12_5mm || ''}
                          onChange={(e) => updateFormData('granulometry', 'sieve_12_5mm', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>Tamiz 9.5 mm (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.granulometry.sieve_9_5mm || ''}
                          onChange={(e) => updateFormData('granulometry', 'sieve_9_5mm', parseFloat(e.target.value))}
                        />
                      </div>
                    </>
                  )}
                  
                  <div>
                    <Label>Tamiz 4.75 mm (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.granulometry.sieve_4_75mm || ''}
                      onChange={(e) => updateFormData('granulometry', 'sieve_4_75mm', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Tamiz 2.36 mm (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.granulometry.sieve_2_36mm || ''}
                      onChange={(e) => updateFormData('granulometry', 'sieve_2_36mm', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Tamiz 1.18 mm (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.granulometry.sieve_1_18mm || ''}
                      onChange={(e) => updateFormData('granulometry', 'sieve_1_18mm', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Tamiz 600 μm (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.granulometry.sieve_600um || ''}
                      onChange={(e) => updateFormData('granulometry', 'sieve_600um', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Tamiz 300 μm (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.granulometry.sieve_300um || ''}
                      onChange={(e) => updateFormData('granulometry', 'sieve_300um', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Tamiz 150 μm (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.granulometry.sieve_150um || ''}
                      onChange={(e) => updateFormData('granulometry', 'sieve_150um', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Tamiz 75 μm (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.granulometry.sieve_75um || ''}
                      onChange={(e) => updateFormData('granulometry', 'sieve_75um', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Fondo (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.granulometry.pan || ''}
                      onChange={(e) => updateFormData('granulometry', 'pan', parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Densidad y Absorción */}
        <TabsContent value="density" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Densidad y Absorción</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Densidad Aparente (kg/m³)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.density.bulk_density || ''}
                    onChange={(e) => updateFormData('density', 'bulk_density', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Densidad Aparente SSS (kg/m³)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.density.bulk_density_ssd || ''}
                    onChange={(e) => updateFormData('density', 'bulk_density_ssd', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Densidad Nominal (kg/m³)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.density.apparent_density || ''}
                    onChange={(e) => updateFormData('density', 'apparent_density', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Absorción (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.density.absorption || ''}
                    onChange={(e) => updateFormData('density', 'absorption', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Desgaste Los Angeles */}
        <TabsContent value="losangeles" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Desgaste Los Angeles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Peso Inicial (g)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.losAngeles.initial_weight || ''}
                    onChange={(e) => updateFormData('losAngeles', 'initial_weight', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Peso Final (g)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.losAngeles.final_weight || ''}
                    onChange={(e) => updateFormData('losAngeles', 'final_weight', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Desgaste (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.losAngeles.wear_percentage || ''}
                    onChange={(e) => updateFormData('losAngeles', 'wear_percentage', parseFloat(e.target.value))}
                    className="bg-gray-50"
                    readOnly
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sanidad */}
        <TabsContent value="sanity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sanidad</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Pérdida con Sulfato de Sodio (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.sanity.sodium_sulfate_loss || ''}
                    onChange={(e) => updateFormData('sanity', 'sodium_sulfate_loss', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Pérdida con Sulfato de Magnesio (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.sanity.magnesium_sulfate_loss || ''}
                    onChange={(e) => updateFormData('sanity', 'magnesium_sulfate_loss', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ensayos Adicionales */}
        <TabsContent value="additional" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Impurezas Orgánicas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Color Estándar</Label>
                  <Select 
                    value={formData.organicImpurities.color_standard?.toString() || ''} 
                    onValueChange={(value) => updateFormData('organicImpurities', 'color_standard', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Muy claro</SelectItem>
                      <SelectItem value="2">2 - Claro</SelectItem>
                      <SelectItem value="3">3 - Medio</SelectItem>
                      <SelectItem value="4">4 - Oscuro</SelectItem>
                      <SelectItem value="5">5 - Muy oscuro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Observaciones</Label>
                  <Textarea
                    value={formData.organicImpurities.observations || ''}
                    onChange={(e) => updateFormData('organicImpurities', 'observations', e.target.value)}
                    placeholder="Observaciones sobre impurezas orgánicas"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {formData.materialType === 'arena' && (
            <Card>
              <CardHeader>
                <CardTitle>Equivalente de Arena</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Lectura Arcilla</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.sandEquivalent?.clay_reading || ''}
                      onChange={(e) => updateFormData('sandEquivalent', 'clay_reading', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Lectura Arena</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.sandEquivalent?.sand_reading || ''}
                      onChange={(e) => updateFormData('sandEquivalent', 'sand_reading', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Equivalente (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.sandEquivalent?.equivalent_percentage || ''}
                      onChange={(e) => updateFormData('sandEquivalent', 'equivalent_percentage', parseFloat(e.target.value))}
                      className="bg-gray-50"
                      readOnly
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Observaciones Generales</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.observations || ''}
                onChange={(e) => updateGeneralData('observations', e.target.value)}
                placeholder="Observaciones generales del análisis"
                rows={4}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
