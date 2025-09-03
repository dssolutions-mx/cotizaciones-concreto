export interface RemisionDocument {
  id: string;
  remision_id: string;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  document_type: 'remision_proof' | 'delivery_evidence' | 'quality_check' | 'additional';
  document_category: 'concrete_remision' | 'pumping_remision' | 'general';
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  url?: string; // Signed URL for viewing
}

export interface RemisionPendingFile {
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
  documentId?: string;
  isCameraCapture?: boolean;
}

export interface RemisionDocumentUploadRequest {
  file: File;
  remision_id: string;
  document_type: 'remision_proof' | 'delivery_evidence' | 'quality_check' | 'additional';
  document_category: 'concrete_remision' | 'pumping_remision' | 'general';
}
