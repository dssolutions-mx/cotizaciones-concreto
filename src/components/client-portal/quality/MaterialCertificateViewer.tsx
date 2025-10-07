'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Download, Loader2, Eye, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Certificate {
  id: string;
  material_id: string;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  certificate_type: string;
  notes: string | null;
  uploaded_by: string;
  created_at: string;
  url: string | null;
}

interface MaterialCertificateViewerProps {
  materialId: string;
  materialName: string;
  materialCategory?: string;
  onClose: () => void;
}

export default function MaterialCertificateViewer({ 
  materialId, 
  materialName,
  materialCategory = 'default',
  onClose 
}: MaterialCertificateViewerProps) {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);

  // iOS 26 Refined Color Configuration
  const getCategoryColors = (category: string) => {
    switch (category) {
      case 'agregado':
        return {
          iconBg: 'bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-50',
          iconColor: 'text-amber-700',
          loader: 'text-amber-600',
          hoverBorder: 'hover:border-amber-200',
          notesBg: 'bg-amber-50/60 border-amber-100',
        };
      case 'cemento':
        return {
          iconBg: 'bg-gradient-to-br from-gray-100 via-slate-50 to-gray-50',
          iconColor: 'text-slate-600',
          loader: 'text-slate-600',
          hoverBorder: 'hover:border-slate-200',
          notesBg: 'bg-slate-50/60 border-slate-100',
        };
      case 'agua':
        return {
          iconBg: 'bg-gradient-to-br from-blue-100 via-cyan-50 to-blue-50',
          iconColor: 'text-cyan-700',
          loader: 'text-cyan-600',
          hoverBorder: 'hover:border-cyan-200',
          notesBg: 'bg-cyan-50/60 border-cyan-100',
        };
      case 'aditivo':
        return {
          iconBg: 'bg-gradient-to-br from-teal-100 via-emerald-50 to-teal-50',
          iconColor: 'text-emerald-700',
          loader: 'text-emerald-600',
          hoverBorder: 'hover:border-emerald-200',
          notesBg: 'bg-emerald-50/60 border-emerald-100',
        };
      default:
        return {
          iconBg: 'bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100',
          iconColor: 'text-gray-600',
          loader: 'text-gray-600',
          hoverBorder: 'hover:border-gray-200',
          notesBg: 'bg-gray-50/60 border-gray-100',
        };
    }
  };

  const colors = getCategoryColors(materialCategory);

  useEffect(() => {
    loadCertificates();
  }, [materialId]);

  const loadCertificates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/materials/certificates?material_id=${materialId}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setCertificates(result.data);
      }
    } catch (error) {
      console.error('Error loading certificates:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getCertificateTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      quality_certificate: 'Certificado de Calidad',
      test_report: 'Reporte de Ensayo',
      compliance_certificate: 'Certificado de Cumplimiento',
      other: 'Otro'
    };
    return types[type] || type;
  };

  return (
    <AnimatePresence>
      <motion.div
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
          {/* iOS 26 Header */}
          <div className="glass-base border-b border-white/20 p-8">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <h2 className="text-title-1 font-bold text-label-primary mb-2">
                  Certificados de Calidad
                </h2>
                <p className="text-callout text-label-secondary font-medium">
                  {materialName}
                </p>
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
                <Loader2 className={`w-16 h-16 ${colors.loader} animate-spin mb-6`} />
                <p className="text-callout text-label-secondary">Cargando certificados...</p>
              </div>
            ) : certificates.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center py-16"
              >
                <FileText className="w-20 h-20 text-label-tertiary mx-auto mb-6" />
                <p className="text-title-2 font-bold text-label-primary mb-3">
                  No hay certificados disponibles
                </p>
                <p className="text-callout text-label-secondary max-w-md mx-auto">
                  Aún no se han cargado certificados para este material.
                </p>
              </motion.div>
            ) : (
              <div className="space-y-5">
                {certificates.map((cert, index) => (
                  <motion.div
                    key={cert.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08, duration: 0.4 }}
                    whileHover={{ y: -2, transition: { duration: 0.2 } }}
                    className={`glass-interactive rounded-3xl p-6 border border-white/20 ${colors.hoverBorder} shadow-sm hover:shadow-lg transition-all duration-300`}
                  >
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex items-start gap-5 flex-1 min-w-0">
                        {/* Icon */}
                        <div className={`p-3.5 ${colors.iconBg} rounded-2xl shrink-0 shadow-sm`}>
                          <FileText className={`w-7 h-7 ${colors.iconColor}`} />
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-title-3 font-semibold text-label-primary mb-2 truncate">
                            {cert.original_name}
                          </h3>
                          
                          <div className="flex flex-wrap gap-4 text-footnote text-label-secondary mb-3">
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-4 h-4" />
                              <span className="font-medium">{getCertificateTypeLabel(cert.certificate_type)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4" />
                              <span>
                                {format(new Date(cert.created_at), 'dd MMM yyyy', { locale: es })}
                              </span>
                            </div>
                            <div className="text-label-tertiary font-medium">
                              {formatFileSize(cert.file_size)}
                            </div>
                          </div>

                          {cert.notes && (
                            <p className={`text-footnote text-label-secondary mt-3 ${colors.notesBg} rounded-xl p-3 border`}>
                              {cert.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2.5 shrink-0">
                        {cert.url && (
                          <>
                            <motion.button
                              onClick={() => setSelectedPdf(cert.url)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="p-3 glass-interactive border-2 border-white/30 hover:border-white/50 text-label-primary rounded-2xl transition-all shadow-sm hover:shadow-md"
                              title="Ver certificado"
                            >
                              <Eye className="w-5 h-5" />
                            </motion.button>
                            <motion.a
                              href={cert.url}
                              download={cert.original_name}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="p-3 glass-interactive border-2 border-white/30 hover:border-white/50 text-label-primary rounded-2xl transition-all shadow-sm hover:shadow-md"
                              title="Descargar certificado"
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

      {/* PDF Viewer Modal - iOS 26 Style */}
      {selectedPdf && (
        <motion.div
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
            {/* iOS 26 PDF Header */}
            <div className="glass-base border-b border-white/20 p-5 flex items-center justify-between">
              <h3 className="text-title-3 font-bold text-label-primary">
                Vista Previa del Certificado
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
  );
}

