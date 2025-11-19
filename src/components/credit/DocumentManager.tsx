'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Upload,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { toast } from 'sonner';
import { CreditDocument } from '@/lib/supabase/creditTerms';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const documentUploadSchema = z.object({
  document_type: z.enum(['pagare', 'contract', 'credit_application', 'other']),
  document_amount: z.string().optional(),
  expiry_date: z.string().optional(),
  notes: z.string().max(500, 'Las notas no pueden exceder 500 caracteres').optional(),
  file: z.any().refine((file) => file !== null, 'El archivo es requerido'),
});

type DocumentUploadFormData = z.infer<typeof documentUploadSchema>;

interface DocumentManagerProps {
  clientId: string;
  clientName: string;
  canUpload?: boolean;
  canVerify?: boolean;
}

export default function DocumentManager({
  clientId,
  clientName,
  canUpload = true,
  canVerify = false,
}: DocumentManagerProps) {
  const [documents, setDocuments] = useState<CreditDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);

  const form = useForm<DocumentUploadFormData>({
    resolver: zodResolver(documentUploadSchema),
    defaultValues: {
      document_type: 'pagare',
      document_amount: '',
      expiry_date: '',
      notes: '',
    },
  });

  useEffect(() => {
    fetchDocuments();
  }, [clientId]);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/credit-documents/${clientId}`);

      if (!response.ok) {
        throw new Error('Error al cargar documentos');
      }

      const result = await response.json();
      setDocuments(result.data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Error al cargar documentos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('El archivo excede el tamaño máximo de 10MB');
      e.target.value = '';
      return;
    }

    // Validate file type
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      toast.error('Tipo de archivo no permitido. Solo PDF e imágenes');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    form.setValue('file', file);
  };

  const onSubmit = async (data: DocumentUploadFormData) => {
    if (!selectedFile) {
      toast.error('Por favor seleccione un archivo');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('client_id', clientId);
      formData.append('document_type', data.document_type);

      if (data.document_amount) {
        formData.append('document_amount', data.document_amount);
      }
      if (data.expiry_date) {
        formData.append('expiry_date', data.expiry_date);
      }
      if (data.notes) {
        formData.append('notes', data.notes);
      }

      const response = await fetch('/api/credit-terms/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al subir documento');
      }

      toast.success('Documento subido exitosamente');
      setIsUploadDialogOpen(false);
      form.reset();
      setSelectedFile(null);
      fetchDocuments(); // Reload documents
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error(error.message || 'Error al subir documento');
    } finally {
      setIsUploading(false);
    }
  };

  const handleVerifyDocument = async (documentId: string, status: string) => {
    try {
      const response = await fetch(
        `/api/credit-terms/documents/${documentId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        }
      );

      if (!response.ok) {
        throw new Error('Error al actualizar estado del documento');
      }

      toast.success('Estado del documento actualizado');
      fetchDocuments();
    } catch (error) {
      console.error('Error verifying document:', error);
      toast.error('Error al verificar documento');
    }
  };

  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;

    try {
      // Note: You would need to implement a DELETE endpoint
      // For now, we'll just show a message
      toast.info('Funcionalidad de eliminación pendiente de implementación');
      setDocumentToDelete(null);
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Error al eliminar documento');
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pagare: 'Pagaré',
      contract: 'Contrato',
      credit_application: 'Solicitud de Crédito',
      other: 'Otro',
    };
    return labels[type] || type;
  };

  const getVerificationStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }
    > = {
      pending: {
        label: 'Pendiente',
        variant: 'outline',
        icon: Clock,
      },
      verified: {
        label: 'Verificado',
        variant: 'default',
        icon: CheckCircle,
      },
      expired: {
        label: 'Vencido',
        variant: 'destructive',
        icon: AlertCircle,
      },
      rejected: {
        label: 'Rechazado',
        variant: 'destructive',
        icon: XCircle,
      },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <>
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Documentos de Crédito
              </CardTitle>
              <CardDescription>
                Pagarés, contratos y documentación de {clientName}
              </CardDescription>
            </div>
            {canUpload && (
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Subir Documento
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Subir Documento de Crédito</DialogTitle>
                    <DialogDescription>
                      Suba un pagaré, contrato u otro documento relacionado al crédito
                    </DialogDescription>
                  </DialogHeader>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="document_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Documento</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccione tipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="pagare">Pagaré</SelectItem>
                                <SelectItem value="contract">Contrato</SelectItem>
                                <SelectItem value="credit_application">
                                  Solicitud de Crédito
                                </SelectItem>
                                <SelectItem value="other">Otro</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="file"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Archivo</FormLabel>
                            <FormControl>
                              <Input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                onChange={handleFileChange}
                              />
                            </FormControl>
                            <FormDescription>
                              PDF o imagen (máx. 10MB)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="document_amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monto (opcional)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Para pagarés, ingrese el monto
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="expiry_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fecha de Vencimiento (opcional)</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notas (opcional)</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Información adicional..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsUploadDialogOpen(false)}
                          disabled={isUploading}
                        >
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={isUploading || !selectedFile}>
                          {isUploading ? 'Subiendo...' : 'Subir'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando documentos...
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No hay documentos subidos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="h-10 w-10 text-blue-600" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{doc.file_name}</p>
                        {getVerificationStatusBadge(doc.verification_status)}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{getDocumentTypeLabel(doc.document_type)}</span>
                        {doc.document_amount && (
                          <>
                            <span>•</span>
                            <span>{formatCurrency(doc.document_amount)}</span>
                          </>
                        )}
                        {doc.expiry_date && (
                          <>
                            <span>•</span>
                            <span>Vence: {formatDate(doc.expiry_date)}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>Subido: {formatDate(doc.upload_date)}</span>
                      </div>
                      {doc.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          {doc.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(doc.file_url, '_blank')}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>

                    {canVerify && doc.verification_status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleVerifyDocument(doc.id, 'verified')}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Verificar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleVerifyDocument(doc.id, 'rejected')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Rechazar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!documentToDelete}
        onOpenChange={() => setDocumentToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El documento será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDocument}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
