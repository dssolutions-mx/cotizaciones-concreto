'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart2, 
  FlaskConical, 
  TrendingUp, 
  CheckCircle 
} from 'lucide-react';
import QualitySummary from './QualitySummary';
import QualityMuestreos from './QualityMuestreos';
import QualityAnalysis from './QualityAnalysis';
import QualitySiteChecks from './QualitySiteChecks';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';

interface QualityTabsProps {
  data: ClientQualityData;
  summary: ClientQualitySummary;
}

export function QualityTabs({ data, summary }: QualityTabsProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'muestreos' | 'analysis' | 'site-checks'>('summary');

  const tabs = [
    { id: 'summary' as const, label: 'Resumen', icon: BarChart2 },
    { id: 'muestreos' as const, label: 'Muestreos', icon: FlaskConical },
    { id: 'analysis' as const, label: 'Análisis', icon: TrendingUp },
    { id: 'site-checks' as const, label: 'Verificaciones', icon: CheckCircle }
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation - iOS 26 Segmented Control Style */}
      <div className="glass-thick rounded-2xl p-1.5 inline-flex w-full overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 
                px-4 py-3 rounded-xl transition-all duration-200
                whitespace-nowrap
                ${isActive 
                  ? 'bg-white dark:bg-gray-800 shadow-md' 
                  : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
                }
              `}
            >
              <Icon className={`w-5 h-5 ${
                isActive ? 'text-systemBlue' : 'text-label-secondary'
              }`} />
              <span className={`text-callout font-medium ${
                isActive ? 'text-label-primary' : 'text-label-secondary'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content with Animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {activeTab === 'summary' && <QualitySummary data={data} summary={summary} />}
          {activeTab === 'muestreos' && <QualityMuestreos data={data} summary={summary} />}
          {activeTab === 'analysis' && <QualityAnalysis data={data} summary={summary} />}
          {activeTab === 'site-checks' && <QualitySiteChecks data={data} summary={summary} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default QualityTabs;

