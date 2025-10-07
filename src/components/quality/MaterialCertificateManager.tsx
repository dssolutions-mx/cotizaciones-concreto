'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Upload,
  FileText,
  Loader2,
  Eye,
  Trash2,
  Download,
  X,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

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

interface MaterialCertificateManagerProps {
  materialId: string;
  materialName: string;
}

export default function MaterialCertificateManager({
  materialId,
  materialName,
}: MaterialCertificateManagerProps) {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Load certificates
  useEffect(() => {
    if (materialId) {
      loadCertificates();
    }
  }, [materialId]);

  const loadCertificates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/materials/certificates?material_id=${materialId}`);
      
      const result = await response.json();

      if (response.ok && result.success) {
        setCertificates(result.data || []);
      } else {
        console.error('Error loading certificates:', result.error);
        // No mostrar toast en carga silenciosa, solo log
      }
    } catch (error) {
      console.error('Error loading certificates:', error);
      // No mostrar toast en carga silenciosa, solo log
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Solo se permiten archivos PDF');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo excede el tamaño máximo de 10MB');
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Seleccione un archivo');
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('material_id', materialId);
      formData.append('certificate_type', 'quality_certificate');
      if (notes) {
        formData.append('notes', notes);
      }

      const response = await fetch('/api/materials/certificates', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(result.message || 'Certificado subido exitosamente');
        setIsDialogOpen(false);
        setSelectedFile(null);
        setNotes('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        loadCertificates();
      } else {
        toast.error(result.error || 'Error al subir certificado');
      }
    } catch (error) {
      console.error('Error uploading certificate:', error);
      toast.error('Error al subir certificado');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (certificateId: string, fileName: string) => {
    if (!confirm(`¿Está seguro de eliminar el certificado "${fileName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/materials/certificates?id=${certificateId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(result.message || 'Certificado eliminado exitosamente');
        loadCertificates();
      } else {
        toast.error(result.error || 'Error al eliminar certificado');
      }
    } catch (error) {
      console.error('Error deleting certificate:', error);
      toast.error('Error al eliminar certificado');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-3">
      {/* Header con contador y botón de subir */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-700" />
          <span className="text-sm font-bold !text-gray-900">
            Certificados
          </span>
          <Badge variant="secondary" className="text-xs font-bold !text-gray-900">
            {certificates.length}
          </Badge>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="secondary"
              size="sm" 
              className="h-8 bg-white border-2 border-gray-300 hover:bg-gray-50 !text-black font-semibold text-xs rounded-lg shadow-sm"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5 text-black" />
              Subir
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="!text-gray-900">Subir Certificado de Calidad</DialogTitle>
              <DialogDescription className="!text-gray-700">
                Material: <span className="font-medium !text-gray-900">{materialName}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* File Input */}
              <div className="space-y-2">
                <Label htmlFor="certificate-file" className="!text-gray-900 font-semibold">Archivo PDF *</Label>
                <Input
                  ref={fileInputRef}
                  id="certificate-file"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileSelect}
                  className="!text-gray-900"
                />
                {selectedFile && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="!text-green-700">{selectedFile.name} ({formatFileSize(selectedFile.size)})</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="!text-gray-900 font-semibold">Notas (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Ej: Certificado de laboratorio ABC, fecha de ensayo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="!text-gray-900 placeholder:text-gray-500"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsDialogOpen(false);
                  setSelectedFile(null);
                  setNotes('');
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                disabled={uploading}
                className="!text-black border-2 border-gray-300 bg-white hover:bg-gray-50"
              >
                Cancelar
              </Button>
              <Button 
                variant="secondary"
                onClick={handleUpload} 
                disabled={uploading || !selectedFile} 
                className="bg-gray-900 hover:bg-black !text-white border-2 border-gray-900"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin text-white" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2 text-white" />
                    Subir
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Certificates List */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : certificates.length === 0 ? (
        <div className="text-center py-6 text-sm bg-white rounded-lg border-2 border-dashed border-gray-200">
          <FileText className="h-10 w-10 mx-auto mb-2 text-gray-400" />
          <p className="font-medium !text-gray-700">Sin certificados</p>
          <p className="text-xs !text-gray-600 mt-1">Sube el primer certificado</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="group bg-white border-2 border-gray-200 rounded-lg p-2.5 hover:border-teal-300 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 bg-red-50 rounded-md flex-shrink-0">
                  <FileText className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold !text-gray-900 truncate leading-tight">
                    {cert.original_name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-medium !text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                      {formatFileSize(cert.file_size)}
                    </span>
                    <span className="text-[10px] !text-gray-700">
                      {formatDate(cert.created_at)}
                    </span>
                  </div>
                  {cert.notes && (
                    <p className="text-[10px] !text-gray-700 mt-1 line-clamp-2 bg-gray-50 p-1.5 rounded leading-snug">
                      {cert.notes}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {cert.url ? (
                    <a href={cert.url} target="_blank" rel="noopener noreferrer">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 w-7 p-0 bg-white border border-gray-300 hover:bg-gray-50 !text-black"
                        title="Ver certificado"
                      >
                        <Eye className="h-3.5 w-3.5 text-black" />
                      </Button>
                    </a>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 w-7 p-0 bg-white border border-gray-300 !text-gray-400"
                      disabled
                      title="URL no disponible"
                    >
                      <AlertCircle className="h-3.5 w-3.5 text-gray-400" />
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 w-7 p-0 bg-white border border-gray-300 hover:bg-red-50 !text-black"
                    onClick={() => handleDelete(cert.id, cert.original_name)}
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-black" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

