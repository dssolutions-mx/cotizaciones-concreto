'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, getISOWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  FileBarChart2,
  ShoppingCart,
} from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';

const hubCards = [
  {
    title: 'Remisiones semanal',
    description: 'Reporte RH de entregas y viajes de la semana',
    icon: BarChart3,
    href: '/rh/remisiones-semanal',
    weekLabel: true,
  },
  {
    title: 'Centro de compras',
    description: 'Procurement, órdenes de compra y cola de acción',
    icon: ShoppingCart,
    href: '/finanzas/procurement',
    weekLabel: false,
  },
  {
    title: 'Grupos de proveedores',
    description: 'Catálogo y agrupación de proveedores',
    icon: Building2,
    href: '/finanzas/proveedores/grupos',
    weekLabel: false,
  },
  {
    title: 'Ventas diarias',
    description: 'Operación del día, ventas y pagos',
    icon: Briefcase,
    href: '/finanzas/ventas-diarias',
    weekLabel: false,
  },
  {
    title: 'Remisiones por cliente',
    description: 'Detalle financiero de remisiones',
    icon: FileBarChart2,
    href: '/finanzas/remisiones',
    weekLabel: false,
  },
  {
    title: 'Reloj checador',
    description: 'Asistencia y tiempos de personal',
    icon: Clock,
    href: '/production-control/reloj-checador',
    weekLabel: false,
  },
] as const;

export function AdminOperationsHub() {
  const router = useRouter();
  const { profile } = useAuthBridge();
  const { currentPlant } = usePlantContext();

  const currentWeek = getISOWeek(new Date());
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const firstName = profile?.first_name;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <p className="text-footnote font-medium text-primary">Admin operaciones</p>
        <h1 className="text-large-title text-gray-900 mt-1">
          {firstName ? `Hola, ${firstName}` : 'Centro operativo'}
        </h1>
        <p className="text-body text-gray-600 mt-2 max-w-2xl">
          Punto de partida para compras, remisiones semanales y reportes operativos — elige el
          espacio que necesites hoy.
        </p>
        {currentPlant && (
          <p className="text-footnote text-muted-foreground mt-2">
            Planta activa: {currentPlant.name}
          </p>
        )}
      </div>

      <div className="mb-8">
        <motion.div
          className="glass-base rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="rounded-xl bg-primary/10 p-2 shrink-0 self-start">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-footnote text-muted-foreground">Semana en curso</p>
            <p className="text-callout font-medium text-gray-900">
              Semana {currentWeek} · {format(weekStart, 'd MMM', { locale: es })} –{' '}
              {format(weekEnd, 'd MMM yyyy', { locale: es })}
            </p>
            <div className="flex flex-wrap gap-4 mt-2">
              <Link
                href="/rh/remisiones-semanal"
                className="text-footnote text-primary hover:underline"
              >
                Abrir remisiones semanal
              </Link>
              <Link
                href="/finanzas/procurement"
                className="text-footnote text-primary hover:underline"
              >
                Ir a centro de compras
              </Link>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {hubCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.button
              key={card.href}
              type="button"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
              onClick={() => router.push(card.href)}
              className="glass-base rounded-2xl p-6 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="inline-flex p-2 rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                {card.weekLabel && (
                  <span className="text-footnote text-muted-foreground font-medium">
                    Semana {currentWeek}
                  </span>
                )}
              </div>
              <h2 className="text-title-3 text-gray-900 mb-2">{card.title}</h2>
              <p className="text-callout text-gray-600 mb-4">{card.description}</p>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
