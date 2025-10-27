'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Download, Loader2, Eye, Calendar, Building, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PlantVerification {
  id: string;
  plant_id: string;
  file_name: string;
  original_name: string | null;
  file_path: string;
  file_size: number;
  notes: string | null;
  uploaded_by: string;
  created_at: string;
  url: string | null;
}

interface PlantVerificationViewerProps {
  plantId: string;
  plantName: string;
  onClose: () => void;
}

export default function PlantVerificationViewer({ 
  plantId, 
  plantName,
  onClose 
}: PlantVerificationViewerProps) {
  const [verifications, setVerifications] = useState<PlantVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);

  useEffect(() => {
    loadVerifications();
  }, [plantId]);

  const loadVerifications = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/plants/verifications?plant_id=${plantId}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setVerifications(result.data);
      }
    } catch (error) {
      console.error('Error loading plant verifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          key="verification-viewer-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="glass-thick rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/30"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="glass-base border-b border-white/20 p-8">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <h2 className="text-title-1 font-bold text-label-primary mb-2">
                  Verificaciones de Planta
                </h2>
                <div className="flex items-center gap-2 text-callout text-label-secondary font-medium">
                  <Building className="w-4 h-4" />
                  <span>{plantName}</span>
                </div>
              </div>
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-3 hover:bg-white/40 dark:hover:bg-gray-700/40 rounded-2xl transition-all"
              >
                <X className="w-6 h-6 text-label-primary" />
              </motion.button>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 overflow-y-auto max-h-[calc(90vh-160px)]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-16 h-16 text-green-600 animate-spin mb-6" />
                <p className="text-callout text-label-secondary">Cargando verificaciones...</p>
              </div>
            ) : verifications.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center py-16"
              >
                <CheckCircle className="w-20 h-20 text-label-tertiary mx-auto mb-6" />
                <p className="text-title-2 font-bold text-label-primary mb-3">
                  No hay verificaciones disponibles
                </p>
                <p className="text-callout text-label-secondary max-w-md mx-auto">
                  Aún no se han cargado verificaciones para esta planta.
                </p>
              </motion.div>
            ) : (
              <div className="space-y-5">
                {verifications.map((verification, index) => (
                  <motion.div
                    key={verification.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08, duration: 0.4 }}
                    whileHover={{ y: -2, transition: { duration: 0.2 } }}
                    className="glass-interactive rounded-3xl p-6 border border-white/20 hover:border-green-200 shadow-sm hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex items-start gap-5 flex-1 min-w-0">
                        {/* Icon */}
                        <div className="p-3.5 bg-gradient-to-br from-green-100 via-green-50 to-green-100 rounded-2xl shrink-0 shadow-sm">
                          <CheckCircle className="w-7 h-7 text-green-700" />
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-title-3 font-semibold text-label-primary mb-2 truncate">
                            {verification.original_name || verification.file_name}
                          </h3>
                          
                          <div className="flex flex-wrap gap-4 text-footnote text-label-secondary mb-3">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4" />
                              <span>
                                {format(new Date(verification.created_at), 'dd MMM yyyy', { locale: es })}
                              </span>
                            </div>
                            <div className="text-label-tertiary font-medium">
                              {formatFileSize(verification.file_size)}
                            </div>
                          </div>

                          {verification.notes && (
                            <p className="text-footnote text-label-secondary mt-3 bg-green-50/60 border-green-100 rounded-xl p-3 border">
                              {verification.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2.5 shrink-0">
                        {verification.url && (
                          <>
                            <motion.button
                              onClick={() => setSelectedPdf(verification.url)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="p-3 glass-interactive border-2 border-white/30 hover:border-white/50 text-label-primary rounded-2xl transition-all shadow-sm hover:shadow-md"
                              title="Ver verificación"
                            >
                              <Eye className="w-5 h-5" />
                            </motion.button>
                            <motion.a
                              href={verification.url}
                              download={verification.original_name || verification.file_name}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="p-3 glass-interactive border-2 border-white/30 hover:border-white/50 text-label-primary rounded-2xl transition-all shadow-sm hover:shadow-md"
                              title="Descargar verificación"
                            >
                              <Download className="w-5 h-5" />
                            </motion.a>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
      </AnimatePresence>

      {/* PDF Viewer Modal */}
      <AnimatePresence>
        {selectedPdf && (
          <motion.div
            key="verification-pdf-viewer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-lg z-[60] flex items-center justify-center p-4"
            onClick={() => setSelectedPdf(null)}
          >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 30 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="glass-thick rounded-3xl shadow-2xl w-full max-w-6xl h-[92vh] overflow-hidden border border-white/30"
            onClick={(e) => e.stopPropagation()}
          >
            {/* PDF Header */}
            <div className="glass-base border-b border-white/20 p-5 flex items-center justify-between">
              <h3 className="text-title-3 font-bold text-label-primary">
                Vista Previa de Verificación
              </h3>
              <motion.button
                onClick={() => setSelectedPdf(null)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2.5 hover:bg-white/40 dark:hover:bg-gray-700/40 rounded-2xl transition-all"
              >
                <X className="w-6 h-6 text-label-primary" />
              </motion.button>
            </div>
            
            {/* PDF Iframe */}
            <iframe
              src={selectedPdf}
              className="w-full h-[calc(92vh-84px)] bg-white"
              title="PDF Viewer"
            />
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

