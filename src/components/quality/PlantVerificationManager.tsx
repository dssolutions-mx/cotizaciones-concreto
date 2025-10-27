'use client';

import React, { useEffect, useRef, useState } from 'react';
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
import { Upload, FileText, Loader2, Eye, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface VerificationRecord {
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

interface PlantVerificationManagerProps {
  plantId: string;
  plantCode?: string;
}

export default function PlantVerificationManager({ plantId, plantCode }: PlantVerificationManagerProps) {
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (plantId) loadVerifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantId]);

  const loadVerifications = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/plants/verifications?plant_id=${plantId}`);
      const result = await res.json();
      if (res.ok && result.success) {
        setRecords(result.data || []);
      } else {
        console.error('Error loading verifications:', result.error);
      }
    } catch (e) {
      console.error('Error loading verifications:', e);
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
    if (file.size > 20 * 1024 * 1024) {
      toast.error('El archivo excede el tamaño máximo de 20MB');
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
      formData.append('plant_id', plantId);
      if (notes) formData.append('notes', notes);

      const res = await fetch('/api/plants/verifications', { method: 'POST', body: formData });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(result.message || 'Verificación subida exitosamente');
        setIsDialogOpen(false);
        setSelectedFile(null);
        setNotes('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadVerifications();
      } else {
        toast.error(result.error || 'Error al subir verificación');
      }
    } catch (e) {
      console.error('Error uploading verification:', e);
      toast.error('Error al subir verificación');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, fileName: string) => {
    if (!confirm(`¿Está seguro de eliminar la verificación "${fileName}"?`)) return;
    try {
      const res = await fetch(`/api/plants/verifications?id=${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(result.message || 'Verificación eliminada exitosamente');
        loadVerifications();
      } else {
        toast.error(result.error || 'Error al eliminar verificación');
      }
    } catch (e) {
      console.error('Error deleting verification:', e);
      toast.error('Error al eliminar verificación');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-700" />
          <span className="text-sm font-bold !text-gray-900">Verificaciones de Planta {plantCode ? `· ${plantCode}` : ''}</span>
          <Badge variant="secondary" className="text-xs font-bold !text-gray-900">{records.length}</Badge>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm" className="h-8 bg-white border-2 border-gray-300 hover:bg-gray-50 !text-black font-semibold text-xs rounded-lg shadow-sm">
              <Upload className="h-3.5 w-3.5 mr-1.5 text-black" />
              Subir
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="!text-gray-900">Subir Verificación de Planta</DialogTitle>
              <DialogDescription className="!text-gray-700">El archivo debe ser PDF, máximo 20MB</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verification-file" className="!text-gray-900 font-semibold">Archivo PDF *</Label>
                <Input ref={fileInputRef} id="verification-file" type="file" accept="application/pdf" onChange={handleFileSelect} className="!text-gray-900" />
                {selectedFile && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="!text-green-700">{selectedFile.name} ({formatFileSize(selectedFile.size)})</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes" className="!text-gray-900 font-semibold">Notas (opcional)</Label>
                <Textarea id="notes" placeholder="Notas de la verificación..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="!text-gray-900 placeholder:text-gray-500" />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsDialogOpen(false);
                  setSelectedFile(null);
                  setNotes('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
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

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-6 text-sm bg-white rounded-lg border-2 border-dashed border-gray-200">
          <FileText className="h-10 w-10 mx-auto mb-2 text-gray-400" />
          <p className="font-medium !text-gray-700">Sin verificaciones</p>
          <p className="text-xs !text-gray-600 mt-1">Sube la primera verificación de planta</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {records.map((rec) => (
            <div key={rec.id} className="group bg-white border-2 border-gray-200 rounded-lg p-2.5 hover:border-teal-300 hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 bg-green-50 rounded-md flex-shrink-0">
                  <FileText className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold !text-gray-900 truncate leading-tight">{rec.original_name || rec.file_name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[10px] font-medium !text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{formatFileSize(rec.file_size)}</span>
                    <span className="text-[10px] !text-gray-700">{formatDate(rec.created_at)}</span>
                    {rec.notes && (
                      <span className="text-[10px] !text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded line-clamp-1">{rec.notes}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {rec.url ? (
                    <a href={rec.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="secondary" size="sm" className="h-7 w-7 p-0 bg-white border border-gray-300 hover:bg-gray-50 !text-black" title="Ver verificación">
                        <Eye className="h-3.5 w-3.5 text-black" />
                      </Button>
                    </a>
                  ) : (
                    <Button variant="secondary" size="sm" className="h-7 w-7 p-0 bg-white border border-gray-300 !text-gray-400" disabled title="URL no disponible">
                      <AlertCircle className="h-3.5 w-3.5 text-gray-400" />
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" className="h-7 w-7 p-0 bg-white border border-gray-300 hover:bg-red-50 !text-black" onClick={() => handleDelete(rec.id, rec.original_name || rec.file_name)} title="Eliminar">
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


