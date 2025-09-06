'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Camera, FileText, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import FileUpload from './FileUpload'

export default function FileUploadDemo() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')

  const handleFileSelect = (files: FileList) => {
    const fileArray = Array.from(files)
    setUploadedFiles(prev => [...prev, ...fileArray])
    setUploadStatus('success')
    
    // Simulate upload delay
    setTimeout(() => {
      setUploadStatus('idle')
    }, 2000)
  }

  const clearFiles = () => {
    setUploadedFiles([])
    setUploadStatus('idle')
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">
          Enhanced File Upload Demo
        </h1>
        <p className="text-gray-600">
          Document scanner functionality with camera capture and PDF generation
        </p>
      </div>

      {/* Feature Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 text-center">
            <Camera className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <h3 className="font-semibold text-blue-900">Camera Capture</h3>
            <p className="text-xs text-blue-700">
              Take photos directly with your device camera
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 text-center">
            <FileText className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h3 className="font-semibold text-green-900">PDF Generation</h3>
            <p className="text-xs text-green-700">
              Convert captures to professional PDF documents
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4 text-center">
            <Upload className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <h3 className="font-semibold text-purple-900">File Upload</h3>
            <p className="text-xs text-purple-700">
              Drag & drop or select existing files
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Upload Component */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Enhanced File Upload
          </CardTitle>
          <CardDescription>
            Try the camera capture feature or upload existing files. The component will automatically
            convert camera captures to PDF or handle individual file uploads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload
            onFileSelect={handleFileSelect}
            acceptedTypes={['image/*', 'application/pdf']}
            multiple={true}
            maxFiles={10}
            maxSize={25}
            uploading={uploadStatus === 'uploading'}
            disabled={false}
          />
        </CardContent>
      </Card>

      {/* Uploaded Files Display */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Uploaded Files ({uploadedFiles.length})
              </span>
              <Button onClick={clearFiles} variant="outline" size="sm">
                Clear All
              </Button>
            </CardTitle>
            <CardDescription>
              Files that have been selected and are ready for processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      {file.type.startsWith('image/') ? (
                        <Camera className="h-5 w-5 text-blue-600" />
                      ) : (
                        <FileText className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {file.type.split('/')[1]?.toUpperCase() || 'Unknown'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {uploadStatus === 'success' && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {uploadStatus === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-yellow-900">How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <h4 className="font-medium text-yellow-900">Camera Capture:</h4>
            <ol className="text-sm text-yellow-800 list-decimal list-inside space-y-1">
              <li>Click "Abrir Cámara" to access your device camera</li>
              <li>Position your document in the camera view</li>
              <li>Click "Capturar" to take a photo</li>
              <li>Repeat for multiple pages if needed</li>
              <li>Click "Generar PDF" to create a document</li>
            </ol>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium text-yellow-900">File Upload:</h4>
            <ol className="text-sm text-yellow-800 list-decimal list-inside space-y-1">
              <li>Drag and drop files onto the upload area</li>
              <li>Or click the upload area to select files</li>
              <li>Supported formats: Images (JPG, PNG, etc.) and PDFs</li>
              <li>Maximum file size: 25MB per file</li>
              <li>Maximum files: 10 per upload</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Technical Notes */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Technical Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>• Camera access requires HTTPS connection and user permission</p>
          <p>• PDF generation uses jsPDF library for client-side processing</p>
          <p>• Fallback to individual images if PDF generation fails</p>
          <p>• All processing happens locally for privacy and performance</p>
          <p>• Component is fully responsive and accessible</p>
        </CardContent>
      </Card>
    </div>
  )
}
