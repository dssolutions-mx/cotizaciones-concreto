'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Download, UserMinus, UserPlus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BulkActionsBarProps {
  selectedCount: number;
  onDeselectAll: () => void;
  onBulkActivate?: () => void;
  onBulkDeactivate?: () => void;
  onBulkExport?: () => void;
  onBulkDelete?: () => void;
}

export function BulkActionsBar({
  selectedCount,
  onDeselectAll,
  onBulkActivate,
  onBulkDeactivate,
  onBulkExport,
  onBulkDelete,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="glass-thick fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 rounded-xl p-4 shadow-lg border"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{selectedCount}</span>
            <span className="text-sm text-gray-600">
              {selectedCount === 1 ? 'usuario seleccionado' : 'usuarios seleccionados'}
            </span>
          </div>

          <div className="h-6 w-px bg-gray-300" />

          <div className="flex items-center gap-2">
            {onBulkActivate && (
              <Button
                size="sm"
                variant="outline"
                onClick={onBulkActivate}
                className="h-8"
              >
                <UserPlus className="h-3 w-3 mr-1" />
                Activar
              </Button>
            )}
            {onBulkDeactivate && (
              <Button
                size="sm"
                variant="outline"
                onClick={onBulkDeactivate}
                className="h-8"
              >
                <UserMinus className="h-3 w-3 mr-1" />
                Desactivar
              </Button>
            )}
            {onBulkExport && (
              <Button
                size="sm"
                variant="outline"
                onClick={onBulkExport}
                className="h-8"
              >
                <Download className="h-3 w-3 mr-1" />
                Exportar
              </Button>
            )}
            {onBulkDelete && (
              <Button
                size="sm"
                variant="outline"
                onClick={onBulkDelete}
                className="h-8 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Eliminar
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onDeselectAll}
              className="h-8"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

