'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Package, 
  TrendingDown, 
  Upload,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react'
import Link from 'next/link'
import DailyInventorySummary from './DailyInventorySummary'
import RecentInventoryActivity from './RecentInventoryActivity'

const quickActions = [
  {
    title: 'Entrada de Materiales',
    description: 'Registrar recepción de materiales del día',
    icon: Package,
    href: '/inventory/entries',
    color: 'blue'
  },
  {
    title: 'Ajustes de Inventario',
    description: 'Registrar salidas manuales y correcciones',
    icon: TrendingDown,
    href: '/inventory/adjustments',
    color: 'orange'
  },
  {
    title: 'Carga Arkik',
    description: 'Subir archivos de consumo Arkik',
    icon: Upload,
    href: '/inventory/arkik-upload',
    color: 'green'
  }
]

interface QuickActionCardProps {
  title: string
  description: string
  icon: React.ElementType
  href: string
  color: string
}

function QuickActionCard({ title, description, icon: Icon, href, color }: QuickActionCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    orange: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
    green: 'bg-green-50 border-green-200 hover:bg-green-100'
  }

  const iconColorClasses = {
    blue: 'text-blue-600',
    orange: 'text-orange-600',
    green: 'text-green-600'
  }

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${colorClasses[color as keyof typeof colorClasses] || 'bg-gray-50'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
            <Icon className={`h-6 w-6 ${iconColorClasses[color as keyof typeof iconColorClasses]}`} />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="text-sm">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Link href={href}>
          <Button className="w-full group">
            Acceder
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

function StatusCard({ icon: Icon, title, value, status }: {
  icon: React.ElementType
  title: string
  value: string | number
  status: 'success' | 'warning' | 'info'
}) {
  const statusColors = {
    success: 'text-green-600 bg-green-50',
    warning: 'text-orange-600 bg-orange-50',
    info: 'text-blue-600 bg-blue-50'
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-full ${statusColors[status]}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DosificadorDashboard() {
  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center lg:text-left">
        <h1 className="text-3xl font-bold text-gray-900">
          Dashboard de Inventario
        </h1>
        <p className="mt-2 text-gray-600">
          Gestión diaria de materiales - {today}
        </p>
      </div>

      {/* Quick Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatusCard
          icon={CheckCircle}
          title="Estado del Sistema"
          value="Operativo"
          status="success"
        />
        <StatusCard
          icon={Clock}
          title="Último Registro"
          value="Hace 2 horas"
          status="info"
        />
        <StatusCard
          icon={AlertTriangle}
          title="Materiales Bajos"
          value="3"
          status="warning"
        />
      </div>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quickActions.map((action) => (
            <QuickActionCard
              key={action.title}
              title={action.title}
              description={action.description}
              icon={action.icon}
              href={action.href}
              color={action.color}
            />
          ))}
        </div>
      </div>

      {/* Daily Summary */}
      <DailyInventorySummary />

      {/* Recent Activity */}
      <RecentInventoryActivity />
    </div>
  )
}
