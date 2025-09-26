'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale, Save, ArrowLeft } from 'lucide-react';

interface MasaEspecificaData {
  a: number | null; // Masa de la muestra S.S.S (kg)
  b: number | null; // Masa de la canastilla incluyendo la muestra, dentro del agua (kg)
  c: number | null; // Masa de canastilla dentro del tanque de agua (kg)
  v: number | null; // Volumen desplazado de agua (dm3)
  ms: number | null; // Masa de la muestra seca (kg)
}

interface FormularioMasaEspecificaProps {
  altaEstudioId: string;
  datosIniciales?: Partial<MasaEspecificaData>;
  onGuardar: (datos: MasaEspecificaData) => Promise<void>;
  onCancelar: () => void;
  isLoading?: boolean;
}

export default function FormularioMasaEspecifica({
  altaEstudioId,
  datosIniciales,
  onGuardar,
  onCancelar,
  isLoading = false
}: FormularioMasaEspecificaProps) {
  const [datos, setDatos] = useState<MasaEspecificaData>({
    a: datosIniciales?.a || null,
    b: datosIniciales?.b || null,
    c: datosIniciales?.c || null,
    v: datosIniciales?.v || null,
    ms: datosIniciales?.ms || null
  });

  const [errores, setErrores] = useState<Record<string, string>>({});

  // Cálculos automáticos
  const calcularMesss = () => {
    if (datos.a && datos.b && datos.c) {
      return datos.a - (datos.b - datos.c);
    }
    return null;
  };

  const calcularMes = () => {
    const messs = calcularMesss();
    if (messs && datos.v) {
      return datos.a && datos.v ? datos.a / datos.v : null;
    }
    return null;
  };

  const calcularMe = () => {
    if (datos.ms && datos.b && datos.c) {
      return datos.ms / (datos.ms + datos.b + datos.c);
    }
    return null;
  };

  const actualizarCampo = (campo: keyof MasaEspecificaData, valor: string) => {
    const valorNumerico = valor === '' ? null : parseFloat(valor);
    setDatos(prev => ({
      ...prev,
      [campo]: valorNumerico
    }));
    
    // Limpiar error si existe
    if (errores[campo]) {
      setErrores(prev => {
        const nuevos = { ...prev };
        delete nuevos[campo];
        return nuevos;
      });
    }
  };

  const validarFormulario = (): boolean => {
    const nuevosErrores: Record<string, string> = {};

    if (!datos.a) nuevosErrores.a = 'Campo requerido';
    if (!datos.b) nuevosErrores.b = 'Campo requerido';
    if (!datos.c) nuevosErrores.c = 'Campo requerido';
    if (!datos.v) nuevosErrores.v = 'Campo requerido';
    if (!datos.ms) nuevosErrores.ms = 'Campo requerido';

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const manejarGuardar = async () => {
    if (validarFormulario()) {
      await onGuardar(datos);
    }
  };

  const messs = calcularMesss();
  const mes = calcularMes();
  const me = calcularMe();

  return (
    <div className="max-w-4xl mx-auto p-6">
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
          Masa Específica (s.s.s. y seca)
        </h1>
        <p className="text-gray-600">
          Ref. NMX-C-164-ONNCCE-2014
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Datos de Laboratorio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Datos de entrada */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="a">Masa de la muestra S.S.S (A) - kg *</Label>
              <Input
                id="a"
                type="number"
                step="0.001"
                value={datos.a || ''}
                onChange={(e) => actualizarCampo('a', e.target.value)}
                placeholder="0.000"
                className={errores.a ? 'border-red-500' : ''}
              />
              {errores.a && <p className="text-sm text-red-500">{errores.a}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="b">Masa canastilla + muestra en agua (B) - kg *</Label>
              <Input
                id="b"
                type="number"
                step="0.001"
                value={datos.b || ''}
                onChange={(e) => actualizarCampo('b', e.target.value)}
                placeholder="0.000"
                className={errores.b ? 'border-red-500' : ''}
              />
              {errores.b && <p className="text-sm text-red-500">{errores.b}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="c">Masa canastilla en agua (C) - kg *</Label>
              <Input
                id="c"
                type="number"
                step="0.001"
                value={datos.c || ''}
                onChange={(e) => actualizarCampo('c', e.target.value)}
                placeholder="0.000"
                className={errores.c ? 'border-red-500' : ''}
              />
              {errores.c && <p className="text-sm text-red-500">{errores.c}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="v">Volumen desplazado (V) - dm³ *</Label>
              <Input
                id="v"
                type="number"
                step="0.001"
                value={datos.v || ''}
                onChange={(e) => actualizarCampo('v', e.target.value)}
                placeholder="0.000"
                className={errores.v ? 'border-red-500' : ''}
              />
              {errores.v && <p className="text-sm text-red-500">{errores.v}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ms">Masa muestra seca (Ms) - kg *</Label>
              <Input
                id="ms"
                type="number"
                step="0.001"
                value={datos.ms || ''}
                onChange={(e) => actualizarCampo('ms', e.target.value)}
                placeholder="0.000"
                className={errores.ms ? 'border-red-500' : ''}
              />
              {errores.ms && <p className="text-sm text-red-500">{errores.ms}</p>}
            </div>
          </div>

          {/* Resultados calculados */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Resultados Calculados</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <Label className="text-sm font-medium text-blue-900">
                  Me s.s.s = A - (B - C)
                </Label>
                <div className="text-2xl font-bold text-blue-700">
                  {messs ? messs.toFixed(3) : '--'} kg/dm³
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <Label className="text-sm font-medium text-green-900">
                  Me s = A / V
                </Label>
                <div className="text-2xl font-bold text-green-700">
                  {mes ? mes.toFixed(3) : '--'} kg/dm³
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <Label className="text-sm font-medium text-purple-900">
                  Me = Ms / (Ms + B + C)
                </Label>
                <div className="text-2xl font-bold text-purple-700">
                  {me ? me.toFixed(3) : '--'} kg/dm³
                </div>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-4 pt-6 border-t">
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
                  Guardar Datos
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
