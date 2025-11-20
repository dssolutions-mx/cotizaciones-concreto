'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Award, User, Droplet, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

interface SalesAgentData {
  agentId: string;
  agentName: string;
  totalVolume: number;
  totalRevenue: number;
  averagePrice: number;
  orderCount: number;
  month: string;
}

interface SalesAgentRankingChartProps {
  data: SalesAgentData[];
  loading?: boolean;
  selectedMonth?: string;
}

export function SalesAgentRankingChart({
  data,
  loading = false,
  selectedMonth
}: SalesAgentRankingChartProps) {
  const [sortBy, setSortBy] = useState<'volume' | 'revenue' | 'avgPrice'>('revenue');

  // Process and sort data
  const rankedAgents = useMemo(() => {
    const sortedData = [...data].sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return b.totalVolume - a.totalVolume;
        case 'revenue':
          return b.totalRevenue - a.totalRevenue;
        case 'avgPrice':
          return b.averagePrice - a.averagePrice;
        default:
          return 0;
      }
    });

    return sortedData.map((agent, index) => ({
      ...agent,
      rank: index + 1,
      percentageOfTop: index === 0
        ? 100
        : (sortBy === 'volume'
          ? (agent.totalVolume / sortedData[0].totalVolume) * 100
          : sortBy === 'revenue'
          ? (agent.totalRevenue / sortedData[0].totalRevenue) * 100
          : (agent.averagePrice / sortedData[0].averagePrice) * 100)
    }));
  }, [data, sortBy]);

  const totalVolume = data.reduce((sum, agent) => sum + agent.totalVolume, 0);
  const totalRevenue = data.reduce((sum, agent) => sum + agent.totalRevenue, 0);

  if (loading) {
    return (
      <div className="glass-thick rounded-3xl p-8 border border-label-tertiary/10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-label-tertiary/10 rounded w-1/3" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-label-tertiary/10 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="glass-thick rounded-3xl p-8 border border-label-tertiary/10 text-center">
        <User className="h-12 w-12 text-label-tertiary mx-auto mb-4" />
        <h3 className="text-title-3 font-semibold text-label-primary mb-2">
          Sin datos de agentes
        </h3>
        <p className="text-callout text-label-secondary">
          No hay información de ventas por agente para el período seleccionado
        </p>
      </div>
    );
  }

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'from-systemGreen/20 to-systemGreen/5 border-systemGreen/30';
    if (rank === 2) return 'from-systemBlue/20 to-systemBlue/5 border-systemBlue/30';
    if (rank === 3) return 'from-systemOrange/20 to-systemOrange/5 border-systemOrange/30';
    return 'from-label-tertiary/5 to-transparent border-label-tertiary/10';
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-systemGreen text-white';
    if (rank === 2) return 'bg-systemBlue text-white';
    if (rank === 3) return 'bg-systemOrange text-white';
    return 'bg-label-tertiary/20 text-label-secondary';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
      className="glass-thick rounded-3xl p-8 border border-label-tertiary/10"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h3 className="text-title-2 font-bold text-label-primary mb-2">
            Ranking de Agentes de Ventas
          </h3>
          <p className="text-callout text-label-secondary">
            Desempeño por agente{selectedMonth && ` - ${selectedMonth}`}
          </p>
        </div>

        {/* Sort Options */}
        <div className="glass-thin rounded-xl p-1 border border-label-tertiary/10">
          <button
            onClick={() => setSortBy('revenue')}
            className={cn(
              "px-4 py-2 rounded-lg text-caption font-medium transition-all duration-200",
              sortBy === 'revenue'
                ? "bg-systemGreen text-white"
                : "text-label-secondary hover:text-label-primary"
            )}
          >
            Ingresos
          </button>
          <button
            onClick={() => setSortBy('volume')}
            className={cn(
              "px-4 py-2 rounded-lg text-caption font-medium transition-all duration-200",
              sortBy === 'volume'
                ? "bg-systemBlue text-white"
                : "text-label-secondary hover:text-label-primary"
            )}
          >
            Volumen
          </button>
          <button
            onClick={() => setSortBy('avgPrice')}
            className={cn(
              "px-4 py-2 rounded-lg text-caption font-medium transition-all duration-200",
              sortBy === 'avgPrice'
                ? "bg-systemOrange text-white"
                : "text-label-secondary hover:text-label-primary"
            )}
          >
            Precio Prom.
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="glass-thin rounded-2xl p-4 border border-label-tertiary/10">
          <p className="text-caption text-label-tertiary mb-1">Total Agentes</p>
          <p className="text-title-2 font-bold text-label-primary">{data.length}</p>
        </div>
        <div className="glass-thin rounded-2xl p-4 border border-systemBlue/20 bg-gradient-to-br from-systemBlue/10 to-systemBlue/5">
          <p className="text-caption text-label-tertiary mb-1">Volumen Total</p>
          <p className="text-title-2 font-bold text-label-primary">{totalVolume.toFixed(1)} m³</p>
        </div>
        <div className="glass-thin rounded-2xl p-4 border border-systemGreen/20 bg-gradient-to-br from-systemGreen/10 to-systemGreen/5">
          <p className="text-caption text-label-tertiary mb-1">Ingresos Totales</p>
          <p className="text-title-2 font-bold text-label-primary">{formatCurrency(totalRevenue)}</p>
        </div>
      </div>

      {/* Rankings List */}
      <div className="space-y-3">
        {rankedAgents.map((agent, index) => (
          <motion.div
            key={agent.agentId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className={cn(
              "glass-thin rounded-2xl p-5 border bg-gradient-to-br transition-all duration-200 hover:shadow-md",
              getRankColor(agent.rank)
            )}
          >
            <div className="flex items-center gap-4">
              {/* Rank Badge */}
              <div className={cn(
                "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-title-3",
                getRankBadgeColor(agent.rank)
              )}>
                {agent.rank === 1 && <Award className="h-6 w-6" />}
                {agent.rank !== 1 && `#${agent.rank}`}
              </div>

              {/* Agent Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-callout font-semibold text-label-primary mb-1 truncate">
                  {agent.agentName}
                </h4>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Droplet className="h-4 w-4 text-systemBlue" />
                    <span className="text-caption text-label-secondary">
                      {agent.totalVolume.toFixed(1)} m³
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-systemGreen" />
                    <span className="text-caption text-label-secondary">
                      {formatCurrency(agent.totalRevenue)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-systemOrange" />
                    <span className="text-caption text-label-secondary">
                      ${agent.averagePrice.toFixed(2)}/m³
                    </span>
                  </div>
                  <span className="text-caption text-label-tertiary">
                    {agent.orderCount} pedidos
                  </span>
                </div>
              </div>

              {/* Performance Bar */}
              <div className="hidden md:block flex-shrink-0 w-32">
                <div className="h-2 bg-label-tertiary/10 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      agent.rank === 1 ? "bg-systemGreen" :
                      agent.rank === 2 ? "bg-systemBlue" :
                      agent.rank === 3 ? "bg-systemOrange" :
                      "bg-label-tertiary/40"
                    )}
                    style={{ width: `${agent.percentageOfTop}%` }}
                  />
                </div>
                <p className="text-caption text-label-tertiary mt-1 text-right">
                  {agent.percentageOfTop.toFixed(0)}%
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
