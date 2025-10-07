'use client';

import { motion } from 'framer-motion';

export function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-10 w-64 bg-gradient-to-r from-gray-200/20 to-gray-300/20 rounded-xl animate-pulse" />
        <div className="h-4 w-48 bg-gradient-to-r from-gray-200/20 to-gray-300/20 rounded-lg animate-pulse" />
      </div>

      {/* Metrics Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-thick rounded-3xl p-6"
          >
            <div className="space-y-3">
              <div className="h-12 w-12 bg-gradient-to-r from-gray-200/20 to-gray-300/20 rounded-2xl animate-pulse" />
              <div className="h-8 w-24 bg-gradient-to-r from-gray-200/20 to-gray-300/20 rounded-lg animate-pulse" />
              <div className="h-4 w-full bg-gradient-to-r from-gray-200/20 to-gray-300/20 rounded animate-pulse" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="glass-thick rounded-3xl p-6">
        <div className="space-y-4">
          <div className="h-6 w-48 bg-gradient-to-r from-gray-200/20 to-gray-300/20 rounded-lg animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 bg-gradient-to-r from-gray-200/20 to-gray-300/20 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProgressLoadingProps {
  progress: number;
  stage: string;
}

export function ProgressLoading({ progress, stage }: ProgressLoadingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background-primary">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-thick rounded-3xl p-8 max-w-md w-full"
      >
        <div className="space-y-6">
          {/* Animated Icon */}
          <div className="relative mx-auto w-20 h-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 border-4 border-systemBlue/30 border-t-systemBlue rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-2 bg-systemBlue/20 rounded-full"
            />
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-caption">
              <span className="text-label-secondary">{stage}</span>
              <span className="text-label-primary font-bold">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-systemBlue to-systemPurple rounded-full"
              />
            </div>
          </div>

          <p className="text-center text-footnote text-label-tertiary">
            Cargando datos de calidad...
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default LoadingSkeleton;

