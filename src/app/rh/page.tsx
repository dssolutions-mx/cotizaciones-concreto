'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getISOWeek, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart3, Clock, ArrowRight, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

const currentWeek = getISOWeek(new Date());
const now = new Date();
const weekStart = new Date(now);
weekStart.setDate(now.getDate() - now.getDay() + 1);
const weekEnd = new Date(weekStart);
weekEnd.setDate(weekStart.getDate() + 6);

const hubCards = [
  {
    title: 'Remisiones Semanal',
    description: 'Reporte semanal de remisiones y entregas',
    icon: BarChart3,
    href: '/rh/remisiones-semanal',
    color: 'blue' as const,
    weekLabel: true,
  },
  {
    title: 'Reloj Checador',
    description: 'Control de asistencia y tiempos',
    icon: Clock,
    href: '/production-control/reloj-checador',
    color: 'green' as const,
    weekLabel: false,
  },
];

export default function RHHubPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-large-title text-gray-900 mb-2">Recursos Humanos</h1>
        <p className="text-body text-gray-600">
          Remisiones semanales y control de asistencia
        </p>
      </div>

      <div className="mb-8">
        <div className="glass-base rounded-2xl p-5 flex items-center gap-4">
          <div className="rounded-xl bg-primary/10 p-2 shrink-0">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-footnote text-muted-foreground">Semana en curso</p>
            <p className="text-callout font-medium text-gray-900">
              Semana {currentWeek} · {format(weekStart, 'd MMM', { locale: es })} – {format(weekEnd, 'd MMM yyyy', { locale: es })}
            </p>
            <div className="flex gap-4 mt-2">
              <Link href="/rh/remisiones-semanal" className="text-footnote text-primary hover:underline">
                Ver reporte de remisiones
              </Link>
              <Link href="/production-control/reloj-checador" className="text-footnote text-primary hover:underline">
                Cargar reloj checador
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {hubCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.button
              key={card.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              onClick={() => router.push(card.href)}
              className="glass-base rounded-2xl p-6 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`inline-flex p-2 rounded-xl ${
                    card.color === 'blue'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                {card.weekLabel && (
                  <span className="text-footnote text-muted-foreground font-medium">
                    Semana {currentWeek}
                  </span>
                )}
              </div>
              <h2 className="text-title-2 text-gray-900 mb-2">{card.title}</h2>
              <p className="text-body text-gray-600 mb-4">{card.description}</p>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
