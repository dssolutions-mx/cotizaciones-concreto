'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface MallaGranulometrica {
  no_malla: string;
  retenido: number | null;
  porc_retenido: number | null;
  porc_acumulado: number | null;
  porc_pasa: number | null;
  orden_malla: number;
}

interface FormularioGranulometriaProps {
  altaEstudioId: string;
  datosIniciales?: MallaGranulometrica[];
  onGuardar: (datos: MallaGranulometrica[]) => Promise<void>;
  onCancelar: () => void;
  isLoading?: boolean;
}

// Mallas estándar con su orden
const mallasEstandar: Array<{no_malla: string, orden: number}> = [
  { no_malla: '3"', orden: 1 },
  { no_malla: '2 1/2"', orden: 2 },
  { no_malla: '2"', orden: 3 },
  { no_malla: '1 1/2"', orden: 4 },
  { no_malla: '1"', orden: 5 },
  { no_malla: '3/4"', orden: 6 },
  { no_malla: '1/2"', orden: 7 },
  { no_malla: '3/8"', orden: 8 },
  { no_malla: '1/4"', orden: 9 },
  { no_malla: 'No. 4', orden: 10 },
  { no_malla: 'No. 8', orden: 11 },
  { no_malla: 'No. 16', orden: 12 },
  { no_malla: 'No. 30', orden: 13 },
  { no_malla: 'No. 50', orden: 14 },
  { no_malla: 'No. 100', orden: 15 },
  { no_malla: 'No. 200', orden: 16 },
  { no_malla: 'Fondo', orden: 17 }
];

export default function FormularioGranulometria({
  altaEstudioId,
  datosIniciales,
  onGuardar,
  onCancelar,
  isLoading = false
}: FormularioGranulometriaProps) {
  const [mallas, setMallas] = useState<MallaGranulometrica[]>(() => {
    if (datosIniciales && datosIniciales.length > 0) {
      return datosIniciales;
    }
    // Inicializar con mallas estándar
    return mallasEstandar.map(malla => ({
      no_malla: malla.no_malla,
      retenido: null,
      porc_retenido: null,
      porc_acumulado: null,
      porc_pasa: null,
      orden_malla: malla.orden
    }));
  });

  const [pesoTotal, setPesoTotal] = useState<number | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});

  // Calcular automáticamente los porcentajes
  const calcularPorcentajes = () => {
    if (!pesoTotal || pesoTotal === 0) return;

    const nuevasMallas = [...mallas];
    let acumulado = 0;

    nuevasMallas.forEach((malla, index) => {
      if (malla.retenido !== null) {
        // Porcentaje retenido
        malla.porc_retenido = (malla.retenido / pesoTotal) * 100;
        
        // Porcentaje acumulado
        acumulado += malla.porc_retenido;
        malla.porc_acumulado = acumulado;
        
        // Porcentaje que pasa
        malla.porc_pasa = 100 - acumulado;
      }
    });

    setMallas(nuevasMallas);
  };

  const actualizarRetenido = (index: number, valor: string) => {
    const valorNumerico = valor === '' ? null : parseFloat(valor);
    const nuevasMallas = [...mallas];
    nuevasMallas[index].retenido = valorNumerico;
    setMallas(nuevasMallas);
    
    // Recalcular porcentajes
    if (pesoTotal) {
      setTimeout(calcularPorcentajes, 100);
    }
  };

  const actualizarPesoTotal = (valor: string) => {
    const valorNumerico = valor === '' ? null : parseFloat(valor);
    setPesoTotal(valorNumerico);
    
    if (valorNumerico) {
      setTimeout(calcularPorcentajes, 100);
    }
  };

  const agregarMallaPersonalizada = () => {
    const nuevaMalla: MallaGranulometrica = {
      no_malla: '',
      retenido: null,
      porc_retenido: null,
      porc_acumulado: null,
      porc_pasa: null,
      orden_malla: mallas.length + 1
    };
    setMallas([...mallas, nuevaMalla]);
  };

  const eliminarMalla = (index: number) => {
    const nuevasMallas = mallas.filter((_, i) => i !== index);
    setMallas(nuevasMallas);
    setTimeout(calcularPorcentajes, 100);
  };

  const actualizarNoMalla = (index: number, valor: string) => {
    const nuevasMallas = [...mallas];
    nuevasMallas[index].no_malla = valor;
    setMallas(nuevasMallas);
  };

  const validarFormulario = (): boolean => {
    const nuevosErrores: Record<string, string> = {};

    if (!pesoTotal) {
      nuevosErrores.pesoTotal = 'El peso total es requerido';
    }

    // Validar que al menos una malla tenga datos
    const hayDatos = mallas.some(malla => malla.retenido !== null && malla.retenido > 0);
    if (!hayDatos) {
      nuevosErrores.general = 'Debe ingresar al menos un valor de retenido';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const manejarGuardar = async () => {
    if (validarFormulario()) {
      // Filtrar solo las mallas que tienen datos
      const mallasConDatos = mallas.filter(malla => 
        malla.no_malla && (malla.retenido !== null && malla.retenido >= 0)
      );
      await onGuardar(mallasConDatos);
    }
  };

  const sumaRetenidos = mallas.reduce((suma, malla) => {
    return suma + (malla.retenido || 0);
  }, 0);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={onCancelar}
          className="mb-4 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Análisis Granulométrico
        </h1>
        <p className="text-gray-600">
          Ref. NMX-C-077-ONNCCE-2019
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label htmlFor="pesoTotal">Peso Total de la Muestra (g) *</Label>
              <Input
                id="pesoTotal"
                type="number"
                step="0.1"
                value={pesoTotal || ''}
                onChange={(e) => actualizarPesoTotal(e.target.value)}
                placeholder="0.0"
                className={errores.pesoTotal ? 'border-red-500' : ''}
              />
              {errores.pesoTotal && <p className="text-sm text-red-500">{errores.pesoTotal}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-sm text-gray-600">Suma Retenidos</div>
              <div className="text-2xl font-bold text-blue-600">
                {sumaRetenidos.toFixed(1)} g
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-sm text-gray-600">Diferencia</div>
              <div className={`text-2xl font-bold ${
                Math.abs(sumaRetenidos - (pesoTotal || 0)) > 5 ? 'text-red-600' : 'text-green-600'
              }`}>
                {pesoTotal ? (sumaRetenidos - pesoTotal).toFixed(1) : '--'} g
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Button
              onClick={agregarMallaPersonalizada}
              variant="outline"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Malla
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Distribución Granulométrica
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errores.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errores.general}</p>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Malla</TableHead>
                  <TableHead>Retenido (g)</TableHead>
                  <TableHead>% Retenido</TableHead>
                  <TableHead>% Acumulado</TableHead>
                  <TableHead>% Que Pasa</TableHead>
                  <TableHead className="w-[50px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mallas.map((malla, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Input
                        value={malla.no_malla}
                        onChange={(e) => actualizarNoMalla(index, e.target.value)}
                        placeholder="No. malla"
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.1"
                        value={malla.retenido || ''}
                        onChange={(e) => actualizarRetenido(index, e.target.value)}
                        placeholder="0.0"
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      {malla.porc_retenido ? malla.porc_retenido.toFixed(2) : '--'}%
                    </TableCell>
                    <TableCell className="text-center">
                      {malla.porc_acumulado ? malla.porc_acumulado.toFixed(2) : '--'}%
                    </TableCell>
                    <TableCell className="text-center">
                      {malla.porc_pasa !== null ? malla.porc_pasa.toFixed(2) : '--'}%
                    </TableCell>
                    <TableCell>
                      {index >= mallasEstandar.length && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => eliminarMalla(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t mt-6">
            <Button variant="outline" onClick={onCancelar} disabled={isLoading}>
              Cancelar
            </Button>
            <Button onClick={manejarGuardar} disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Granulometría
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
