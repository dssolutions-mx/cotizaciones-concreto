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
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface SafetySheet {
  id: string;
  material_id: string;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  sheet_type: string;
  notes: string | null;
  uploaded_by: string;
  created_at: string;
  url: string | null;
}

interface MaterialSafetySheetManagerProps {
  materialId: string;
  materialName: string;
}

export default function MaterialSafetySheetManager({
  materialId,
  materialName,
}: MaterialSafetySheetManagerProps) {
  const [sheets, setSheets] = useState<SafetySheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Load safety sheets
  useEffect(() => {
    if (materialId) {
      loadSheets();
    }
  }, [materialId]);

  const loadSheets = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Silently fail if no session
        return;
      }

      const response = await fetch(`/api/materials/safety-sheets?material_id=${materialId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const result = await response.json();

      if (response.ok && result.success) {
        setSheets(result.data || []);
      } else {
        // Silently fail - table might not exist yet
        setSheets([]);
      }
    } catch (error) {
      // Silently fail - table might not exist yet
      setSheets([]);
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

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('No hay sesión activa');
        return;
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('material_id', materialId);
      if (notes) {
        formData.append('notes', notes);
      }

      const response = await fetch('/api/materials/safety-sheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(result.message || 'Hoja de seguridad subida exitosamente');
        setIsDialogOpen(false);
        setSelectedFile(null);
        setNotes('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        loadSheets();
      } else {
        toast.error(result.error || 'Error al subir hoja de seguridad');
      }
    } catch (error) {
      console.error('Error uploading safety sheet:', error);
      toast.error('Error al subir hoja de seguridad');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (sheetId: string, fileName: string) => {
    if (!confirm(`¿Está seguro de eliminar la hoja de seguridad "${fileName}"?`)) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('No hay sesión activa');
        return;
      }

      const response = await fetch(`/api/materials/safety-sheets?id=${sheetId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(result.message || 'Hoja de seguridad eliminada exitosamente');
        loadSheets();
      } else {
        toast.error(result.error || 'Error al eliminar hoja de seguridad');
      }
    } catch (error) {
      console.error('Error deleting safety sheet:', error);
      toast.error('Error al eliminar hoja de seguridad');
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
            Hojas de Seguridad
          </span>
          <Badge variant="secondary" className="text-xs font-bold !text-gray-900">
            {sheets.length}
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
              <DialogTitle className="!text-gray-900">Subir Hoja de Seguridad (MSDS)</DialogTitle>
              <DialogDescription className="!text-gray-700">
                Material: <span className="font-medium !text-gray-900">{materialName}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* File Input */}
              <div className="space-y-2">
                <Label htmlFor="sheet-file" className="!text-gray-900 font-semibold">Archivo PDF *</Label>
                <Input
                  ref={fileInputRef}
                  id="sheet-file"
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
                  placeholder="Ej: MSDS actualizado, proveedor certificado..."
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
                className="bg-blue-600 hover:bg-blue-700 !text-white border-2 border-blue-600"
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

      {/* Sheets List */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : sheets.length === 0 ? (
        <div className="text-center py-6 text-sm bg-white rounded-lg border-2 border-dashed border-gray-200">
          <FileText className="h-10 w-10 mx-auto mb-2 text-gray-400" />
          <p className="font-medium !text-gray-700">Sin hojas de seguridad</p>
          <p className="text-xs !text-gray-600 mt-1">Sube la primera hoja de seguridad</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {sheets.map((sheet) => (
            <div
              key={sheet.id}
              className="group bg-white border-2 border-gray-200 rounded-lg p-2.5 hover:border-blue-300 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 bg-blue-50 rounded-md flex-shrink-0">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold !text-gray-900 truncate leading-tight">
                    {sheet.original_name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-medium !text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                      {formatFileSize(sheet.file_size)}
                    </span>
                    <span className="text-[10px] !text-gray-700">
                      {formatDate(sheet.created_at)}
                    </span>
                  </div>
                  {sheet.notes && (
                    <p className="text-[10px] !text-gray-700 mt-1 line-clamp-2 bg-gray-50 p-1.5 rounded leading-snug">
                      {sheet.notes}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {sheet.url ? (
                    <a href={sheet.url} target="_blank" rel="noopener noreferrer">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 w-7 p-0 bg-white border border-gray-300 hover:bg-gray-50 !text-black"
                        title="Ver hoja de seguridad"
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
                    onClick={() => handleDelete(sheet.id, sheet.original_name)}
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

