import React from 'react';
import { Plus, Minus, Edit2, Save, X } from 'lucide-react';
import { Materials, Additive } from '@/types/calculator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MaterialConfigurationProps {
  materials: Materials;
  onMaterialUpdate: (type: keyof Materials, index: number, field: string, value: any) => void;
  onAddAdditive: () => void;
  onRemoveAdditive: (index: number) => void;
}

export const MaterialConfiguration: React.FC<MaterialConfigurationProps> = ({
  materials,
  onMaterialUpdate,
  onAddAdditive,
  onRemoveAdditive
}) => {
  const [editingMaterial, setEditingMaterial] = React.useState<{
    type: keyof Materials;
    index: number;
  } | null>(null);

  const [tempValues, setTempValues] = React.useState<any>({});

  const startEditing = (type: keyof Materials, index: number) => {
    const material = type === 'cement' 
      ? materials.cement 
      : (materials[type] as any[])[index];
    
    setEditingMaterial({ type, index });
    setTempValues({ ...material });
  };

  const saveChanges = () => {
    if (!editingMaterial) return;
    
    Object.entries(tempValues).forEach(([field, value]) => {
      onMaterialUpdate(editingMaterial.type, editingMaterial.index, field, value);
    });
    
    setEditingMaterial(null);
    setTempValues({});
  };

  const cancelEditing = () => {
    setEditingMaterial(null);
    setTempValues({});
  };

  const isEditing = (type: keyof Materials, index: number) => {
    return editingMaterial?.type === type && editingMaterial?.index === index;
  };

  const renderMaterialRow = (material: any, type: keyof Materials, index: number = 0) => {
    const editing = isEditing(type, index);
    
    return (
      <TableRow key={`${type}-${index}`}>
        <TableCell>
          {editing ? (
            <Input
              value={tempValues.material_name || ''}
              onChange={(e) => setTempValues({ ...tempValues, material_name: e.target.value })}
              className="h-8 w-32"
            />
          ) : (
            <span className="font-medium">{material.material_name}</span>
          )}
        </TableCell>
        
        <TableCell>
          {editing ? (
            <Input
              type="number"
              value={tempValues.density || ''}
              onChange={(e) => setTempValues({ ...tempValues, density: parseFloat(e.target.value) || 0 })}
              className="h-8 w-20"
              step="0.01"
            />
          ) : (
            material.density.toFixed(2)
          )}
        </TableCell>
        
        <TableCell>
          {editing ? (
            <Input
              type="number"
              value={tempValues.absorption || ''}
              onChange={(e) => setTempValues({ ...tempValues, absorption: parseFloat(e.target.value) || 0 })}
              className="h-8 w-20"
              step="0.1"
            />
          ) : (
            `${material.absorption}%`
          )}
        </TableCell>
        
        <TableCell>
          {editing ? (
            <Input
              type="number"
              value={tempValues.cost || ''}
              onChange={(e) => setTempValues({ ...tempValues, cost: parseFloat(e.target.value) || 0 })}
              className="h-8 w-24"
              step="0.01"
            />
          ) : (
            `$${material.cost.toFixed(2)}`
          )}
        </TableCell>
        
        <TableCell>
          {editing ? (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={saveChanges}>
                <Save className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEditing}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => startEditing(type, index)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  };

  const renderAdditiveRow = (additive: Additive, index: number) => {
    const editing = isEditing('additives', index);
    
    return (
      <TableRow key={`additive-${index}`}>
        <TableCell>
          {editing ? (
            <Input
              value={tempValues.name || ''}
              onChange={(e) => setTempValues({ ...tempValues, name: e.target.value })}
              className="h-8 w-32"
            />
          ) : (
            <span className="font-medium">{additive.name}</span>
          )}
        </TableCell>
        
        <TableCell>
          {editing ? (
            <Input
              type="number"
              value={tempValues.density || ''}
              onChange={(e) => setTempValues({ ...tempValues, density: parseFloat(e.target.value) || 0 })}
              className="h-8 w-20"
              step="0.01"
            />
          ) : (
            additive.density.toFixed(2)
          )}
        </TableCell>
        
        <TableCell>
          {editing ? (
            <Input
              type="number"
              value={tempValues.cost || ''}
              onChange={(e) => setTempValues({ ...tempValues, cost: parseFloat(e.target.value) || 0 })}
              className="h-8 w-24"
              step="0.01"
            />
          ) : (
            `$${additive.cost.toFixed(2)}`
          )}
        </TableCell>
        
        <TableCell>
          {editing ? (
            <Input
              type="number"
              value={tempValues.cc || ''}
              onChange={(e) => setTempValues({ ...tempValues, cc: parseFloat(e.target.value) || 0 })}
              className="h-8 w-20"
              step="0.1"
            />
          ) : (
            `${additive.cc} cc`
          )}
        </TableCell>
        
        <TableCell>
          {editing ? (
            <Input
              type="number"
              value={tempValues.percentage || ''}
              onChange={(e) => setTempValues({ ...tempValues, percentage: parseFloat(e.target.value) || 0 })}
              className="h-8 w-20"
              step="0.01"
            />
          ) : (
            `${additive.percentage}%`
          )}
        </TableCell>
        
        <TableCell>
          <div className="flex gap-1">
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={saveChanges}>
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEditing}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => startEditing('additives', index)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                {!additive.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveAdditive(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const renderEnhancedAdditiveRow = (additive: Additive, index: number) => {
    const editing = isEditing('additives', index);
    
    return (
      <TableRow key={`additive-${index}`} className="hover:bg-green-50">
        <TableCell>
          {editing ? (
            <Input
              value={tempValues.name || ''}
              onChange={(e) => setTempValues({ ...tempValues, name: e.target.value })}
              className="h-8 w-40"
              placeholder="Nombre del aditivo"
            />
          ) : (
            <div>
              <span className="font-medium text-green-800">{additive.name}</span>
              {additive.isDefault && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Default
                </span>
              )}
            </div>
          )}
        </TableCell>
        
        <TableCell className="text-center">
          {editing ? (
            <Input
              type="number"
              value={tempValues.cc || ''}
              onChange={(e) => setTempValues({ ...tempValues, cc: parseFloat(e.target.value) || 0 })}
              className="h-8 w-20"
              step="0.1"
              placeholder="5.0"
            />
          ) : (
            <span className="font-mono">{additive.cc}</span>
          )}
        </TableCell>
        
        <TableCell className="text-center">
          {editing ? (
            <Input
              type="number"
              value={tempValues.percentage || ''}
              onChange={(e) => setTempValues({ ...tempValues, percentage: parseFloat(e.target.value) || 0 })}
              className="h-8 w-20"
              step="0.01"
              placeholder="100"
            />
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono">{additive.percentage}</span>
              <div className="w-16 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-400 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(additive.percentage, 100)}%` }}
                />
              </div>
            </div>
          )}
        </TableCell>
        
        <TableCell className="text-center">
          {editing ? (
            <Input
              type="number"
              value={tempValues.cost || ''}
              onChange={(e) => setTempValues({ ...tempValues, cost: parseFloat(e.target.value) || 0 })}
              className="h-8 w-24"
              step="0.01"
              placeholder="16.1"
            />
          ) : (
            <span className="font-mono">${additive.cost.toFixed(2)}</span>
          )}
        </TableCell>
        
        <TableCell className="text-center">
          {editing ? (
            <Input
              type="number"
              value={tempValues.density || ''}
              onChange={(e) => setTempValues({ ...tempValues, density: parseFloat(e.target.value) || 0 })}
              className="h-8 w-20"
              step="0.01"
              placeholder="1.626"
            />
          ) : (
            <span className="font-mono">{additive.density.toFixed(3)}</span>
          )}
        </TableCell>
        
        <TableCell className="text-center">
          <div className="flex gap-1 justify-center">
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={saveChanges} className="text-green-600">
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEditing} className="text-red-600">
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => startEditing('additives', index)}
                  className="text-blue-600"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                {!additive.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveAdditive(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de Materiales</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="cement">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="cement">Cemento</TabsTrigger>
            <TabsTrigger value="sands">Arenas</TabsTrigger>
            <TabsTrigger value="gravels">Gravas</TabsTrigger>
            <TabsTrigger value="additives">Aditivos</TabsTrigger>
          </TabsList>

          {/* Cement Tab */}
          <TabsContent value="cement" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Densidad (g/cm³)</TableHead>
                  <TableHead>Absorción (%)</TableHead>
                  <TableHead>Costo ($/ton)</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderMaterialRow(materials.cement, 'cement', 0)}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Sands Tab */}
          <TabsContent value="sands" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Densidad (g/cm³)</TableHead>
                  <TableHead>Absorción (%)</TableHead>
                  <TableHead>Costo ($/m³)</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.sands.map((sand, index) => 
                  renderMaterialRow(sand, 'sands', index)
                )}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Gravels Tab */}
          <TabsContent value="gravels" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Densidad (g/cm³)</TableHead>
                  <TableHead>Absorción (%)</TableHead>
                  <TableHead>Costo ($/m³)</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.gravels.map((gravel, index) => 
                  renderMaterialRow(gravel, 'gravels', index)
                )}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Additives Tab */}
          <TabsContent value="additives" className="mt-4">
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">🧪 Configuración de Aditivos</h4>
                <p className="text-sm text-blue-700">
                  Configure los aditivos que se utilizarán en las mezclas. Puede definir la dosificación por CC (ml) y el porcentaje de distribución.
                </p>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow className="bg-green-50">
                    <TableHead>Nombre del Aditivo</TableHead>
                    <TableHead className="text-center">CC (ml/kg)</TableHead>
                    <TableHead className="text-center">% Distrib.</TableHead>
                    <TableHead className="text-center">$/kg</TableHead>
                    <TableHead className="text-center">Densidad</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.additives.map((additive, index) => 
                    renderEnhancedAdditiveRow(additive, index)
                  )}
                </TableBody>
              </Table>
              
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={onAddAdditive}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Aditivo
                </Button>
                
                <div className="bg-yellow-50 p-3 rounded">
                  <p className="text-xs text-yellow-800">
                    <strong>Nota:</strong> CC = Factor de concentración (ml de aditivo por kg de cemento)<br/>
                    % Distrib. = Porcentaje de distribución dentro del total de aditivos
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};