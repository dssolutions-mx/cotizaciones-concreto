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

      if (result.success) {
        setCertificates(result.data || []);
      } else {
        console.error('Error loading certificates:', result.error);
      }
    } catch (error) {
      console.error('Error loading certificates:', error);
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

      if (result.success) {
        toast.success('Certificado subido exitosamente');
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

      if (result.success) {
        toast.success('Certificado eliminado exitosamente');
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
      {/* Upload Button */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            Subir Certificado
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Subir Certificado de Calidad</DialogTitle>
            <DialogDescription>
              Material: <span className="font-medium">{materialName}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File Input */}
            <div className="space-y-2">
              <Label htmlFor="certificate-file">Archivo PDF *</Label>
              <Input
                ref={fileInputRef}
                id="certificate-file"
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
              />
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>{selectedFile.name} ({formatFileSize(selectedFile.size)})</span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Ej: Certificado de laboratorio ABC, fecha de ensayo..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setSelectedFile(null);
                setNotes('');
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Subir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certificates List */}
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : certificates.length === 0 ? (
        <div className="text-center py-4 text-sm text-gray-500 bg-gray-50 rounded-lg border border-dashed">
          <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p>Sin certificados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="h-5 w-5 text-red-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {cert.original_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {formatFileSize(cert.file_size)}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {formatDate(cert.created_at)}
                    </span>
                  </div>
                  {cert.notes && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                      {cert.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {cert.url ? (
                  <a href={cert.url} target="_blank" rel="noopener noreferrer">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="Ver certificado"
                    >
                      <Eye className="h-4 w-4 text-blue-600" />
                    </Button>
                  </a>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled
                    title="URL no disponible"
                  >
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDelete(cert.id, cert.original_name)}
                  title="Eliminar certificado"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

