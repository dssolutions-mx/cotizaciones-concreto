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

  // Configuración de colores por categoría
  const getCategoryColors = (category: string) => {
    switch (category) {
      case 'agregado':
        return {
          header: 'from-yellow-600 via-amber-600 to-yellow-700',
          iconBg: 'from-yellow-600 to-amber-600',
          button: 'bg-yellow-600 hover:bg-yellow-700',
          loader: 'text-yellow-600',
          hoverBorder: 'hover:border-yellow-300',
          notesBg: 'bg-yellow-50/80 border-yellow-200/50',
          overlay: 'bg-yellow-900/90',
          pdfHeader: 'from-yellow-700 to-amber-700'
        };
      case 'cemento':
        return {
          header: 'from-slate-700 via-slate-600 to-slate-800',
          iconBg: 'from-slate-600 to-slate-700',
          button: 'bg-slate-600 hover:bg-slate-700',
          loader: 'text-slate-600',
          hoverBorder: 'hover:border-slate-300',
          notesBg: 'bg-slate-50/80 border-slate-200/50',
          overlay: 'bg-slate-900/90',
          pdfHeader: 'from-slate-700 to-slate-800'
        };
      case 'agua':
        return {
          header: 'from-cyan-600 via-blue-600 to-cyan-700',
          iconBg: 'from-cyan-600 to-blue-600',
          button: 'bg-cyan-600 hover:bg-cyan-700',
          loader: 'text-cyan-600',
          hoverBorder: 'hover:border-cyan-300',
          notesBg: 'bg-cyan-50/80 border-cyan-200/50',
          overlay: 'bg-cyan-900/90',
          pdfHeader: 'from-cyan-700 to-blue-700'
        };
      case 'aditivo':
        return {
          header: 'from-emerald-600 via-teal-600 to-emerald-700',
          iconBg: 'from-emerald-600 to-teal-600',
          button: 'bg-emerald-600 hover:bg-emerald-700',
          loader: 'text-emerald-600',
          hoverBorder: 'hover:border-emerald-300',
          notesBg: 'bg-emerald-50/80 border-emerald-200/50',
          overlay: 'bg-emerald-900/90',
          pdfHeader: 'from-emerald-700 to-teal-700'
        };
      default:
        return {
          header: 'from-slate-800 via-slate-700 to-slate-900',
          iconBg: 'from-slate-700 to-slate-800',
          button: 'bg-slate-700 hover:bg-slate-800',
          loader: 'text-slate-700',
          hoverBorder: 'hover:border-slate-300',
          notesBg: 'bg-slate-50/80 border-slate-200/50',
          overlay: 'bg-slate-900/90',
          pdfHeader: 'from-slate-800 to-slate-900'
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
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/20"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`bg-gradient-to-br ${colors.header} p-6 text-white`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">Certificados de Calidad</h2>
                <p className="text-white/90 text-sm">{materialName}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className={`w-12 h-12 ${colors.loader} animate-spin mb-4`} />
                <p className="text-gray-600">Cargando certificados...</p>
              </div>
            ) : certificates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg mb-2">No hay certificados disponibles</p>
                <p className="text-gray-500 text-sm">
                  Aún no se han cargado certificados para este material.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {certificates.map((cert, index) => (
                  <motion.div
                    key={cert.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`group bg-gradient-to-br from-white/90 to-gray-50/90 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 ${colors.hoverBorder} hover:shadow-lg transition-all duration-300`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className={`p-3 bg-gradient-to-br ${colors.iconBg} rounded-xl text-white shrink-0`}>
                          <FileText className="w-6 h-6" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 mb-1 truncate">
                            {cert.original_name}
                          </h3>
                          
                          <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-2">
                            <div className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              <span>{getCertificateTypeLabel(cert.certificate_type)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>
                                {format(new Date(cert.created_at), 'dd MMM yyyy', { locale: es })}
                              </span>
                            </div>
                            <div className="text-gray-500">
                              {formatFileSize(cert.file_size)}
                            </div>
                          </div>

                          {cert.notes && (
                            <p className={`text-sm text-gray-600 mt-2 ${colors.notesBg} rounded-lg p-2 border`}>
                              {cert.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        {cert.url && (
                          <>
                            <button
                              onClick={() => setSelectedPdf(cert.url)}
                              className={`p-2 ${colors.button} text-white rounded-xl transition-colors shadow-sm`}
                              title="Ver certificado"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <a
                              href={cert.url}
                              download={cert.original_name}
                              className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm"
                              title="Descargar certificado"
                            >
                              <Download className="w-5 h-5" />
                            </a>
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

      {/* PDF Viewer Modal */}
      {selectedPdf && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 ${colors.overlay} backdrop-blur-md z-[60] flex items-center justify-center p-4`}
          onClick={() => setSelectedPdf(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`bg-gradient-to-r ${colors.pdfHeader} p-4 flex items-center justify-between`}>
              <h3 className="text-white font-semibold text-lg">Vista Previa del Certificado</h3>
              <button
                onClick={() => setSelectedPdf(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe
              src={selectedPdf}
              className="w-full h-[calc(90vh-64px)]"
              title="PDF Viewer"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

