'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText,
  ShieldAlert,
  Award,
  ArrowRight,
  Construction,
  Loader2,
} from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import Link from 'next/link';

interface MenuOption {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  available: boolean;
}

export default function EstudiosMenuPage() {
  const { session, profile, isLoading } = useAuthBridge();

  const menuOptions: MenuOption[] = [
    {
      title: 'Fichas Técnicas',
      description: 'Gestión de fichas técnicas de materiales y productos',
      href: '/quality/estudios/fichas-tecnicas',
      icon: FileText,
      color: 'text-yellow-600',
      gradientFrom: 'from-yellow-50',
      gradientTo: 'to-yellow-100',
      available: true,
    },
    {
      title: 'Hojas de Seguridad',
      description: 'Hojas de datos de seguridad (MSDS) de materiales',
      href: '/quality/estudios/hojas-seguridad',
      icon: ShieldAlert,
      color: 'text-blue-600',
      gradientFrom: 'from-blue-50',
      gradientTo: 'to-blue-100',
      available: true,
    },
    {
      title: 'Certificados',
      description: 'Certificados de calidad de materiales y plantas',
      href: '/quality/estudios/certificados',
      icon: Award,
      color: 'text-green-600',
      gradientFrom: 'from-green-50',
      gradientTo: 'to-green-100',
      available: true,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Verificando autenticación...</span>
        </div>
      </div>
    );
  }

  if (!session || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert className="max-w-md">
          <AlertDescription>
            No se pudo verificar la autenticación. Por favor, inicie sesión nuevamente.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Verificar permisos de acceso a la página
  const hasPageAccess = profile.role === 'QUALITY_TEAM' || profile.role === 'EXECUTIVE';

  if (!hasPageAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert className="max-w-md">
          <AlertDescription>
            No tiene permisos para acceder a esta página. Solo usuarios con rol QUALITY_TEAM o
            EXECUTIVE pueden ver esta sección.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl flex items-center justify-center shadow-lg">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                Estudios y Documentación
              </h1>
              <p className="text-base text-gray-600 mt-1">
                Acceso a fichas técnicas, hojas de seguridad y certificados de calidad
              </p>
            </div>
          </div>
        </div>

        {/* Menu Options as Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuOptions.map((option) => {
            const Icon = option.icon;
            const isAvailable = option.available;

            if (isAvailable) {
              return (
                <Link key={option.title} href={option.href}>
                  <Card className={`h-full hover:shadow-xl transition-all duration-300 cursor-pointer bg-gradient-to-br ${option.gradientFrom} ${option.gradientTo} border-2 hover:scale-105`}>
                    <CardHeader>
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-white shadow-md`}>
                          <Icon className={`h-7 w-7 ${option.color}`} />
                        </div>
                        <ArrowRight className={`h-6 w-6 ${option.color}`} />
                      </div>
                      <CardTitle className="text-2xl font-bold text-gray-900">
                        {option.title}
                      </CardTitle>
                      <CardDescription className="text-base text-gray-700 mt-2">
                        {option.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <Badge variant="default" className={`${option.color.replace('text', 'bg').replace('600', '600')} text-white px-3 py-1`}>
                          Disponible
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            } else {
              return (
                <Card key={option.title} className={`h-full bg-gradient-to-br ${option.gradientFrom} ${option.gradientTo} border-2 opacity-75 cursor-not-allowed`}>
                  <CardHeader>
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-white shadow-md`}>
                        <Icon className={`h-7 w-7 ${option.color}`} />
                      </div>
                      <Construction className="h-6 w-6 text-gray-500" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-900">
                      {option.title}
                    </CardTitle>
                    <CardDescription className="text-base text-gray-700 mt-2">
                      {option.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="bg-gray-300 text-gray-700 px-3 py-1">
                        En desarrollo
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            }
          })}
        </div>

        {/* Info Alert */}
        <div className="mt-8">
          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-gray-700">
              💡 Todas las secciones están disponibles. Selecciona una opción para gestionar documentos de materiales.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
