'use client';

import React, { useState, useRef } from 'react';
import { Button } from './button';
import { Upload, X } from 'lucide-react';

type FileUploaderProps = {
  accept?: string;
  maxFiles?: number;
  maxSize?: number; // in bytes
  onFilesSelected: (files: File[]) => void;
};

export function FileUploader({
  accept = '*',
  maxFiles = 5,
  maxSize = 5 * 1024 * 1024, // Default 5MB
  onFilesSelected,
}: FileUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    validateAndSetFiles(files);
  };

  const validateAndSetFiles = (newFiles: File[]) => {
    const newErrors: string[] = [];
    
    // Check if adding new files would exceed the maximum allowed files
    if (selectedFiles.length + newFiles.length > maxFiles) {
      newErrors.push(`No puedes subir más de ${maxFiles} archivos.`);
      return setErrors(newErrors);
    }
    
    // Validate each file
    const validFiles = newFiles.filter(file => {
      // Check file size
      if (file.size > maxSize) {
        newErrors.push(`El archivo "${file.name}" excede el tamaño máximo permitido.`);
        return false;
      }
      
      // Check file type if accept is specified
      if (accept !== '*') {
        const acceptedTypes = accept.split(',').map(type => type.trim());
        const fileType = file.type || '';
        const fileExtension = '.' + file.name.split('.').pop();
        
        // Check if file type or extension matches any accepted type
        const isAccepted = acceptedTypes.some(type => {
          if (type.startsWith('.')) {
            // It's an extension
            return fileExtension.toLowerCase() === type.toLowerCase();
          } else if (type.includes('*')) {
            // It's a mime type with wildcard
            const [mainType, subType] = type.split('/');
            const [fileMainType, fileSubType] = fileType.split('/');
            return mainType === '*' || (mainType === fileMainType && (subType === '*' || subType === fileSubType));
          } else {
            // It's an exact mime type
            return fileType === type;
          }
        });
        
        if (!isAccepted) {
          newErrors.push(`El archivo "${file.name}" no es un tipo permitido.`);
          return false;
        }
      }
      
      return true;
    });
    
    if (newErrors.length > 0) {
      setErrors(newErrors);
    } else {
      const updatedFiles = [...selectedFiles, ...validFiles];
      setSelectedFiles(updatedFiles);
      onFilesSelected(updatedFiles);
      setErrors([]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    validateAndSetFiles(files);
  };

  const handleRemoveFile = (index: number) => {
    const updatedFiles = [...selectedFiles];
    updatedFiles.splice(index, 1);
    setSelectedFiles(updatedFiles);
    onFilesSelected(updatedFiles);
  };

  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="hidden"
        accept={accept}
        multiple={maxFiles > 1}
      />
      
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600 mb-1">
          Arrastra archivos aquí o haz clic para seleccionar
        </p>
        <p className="text-xs text-gray-500">
          {accept !== '*' ? `Formatos permitidos: ${accept}` : ''}
          {maxSize && ` · Tamaño máximo: ${Math.round(maxSize / (1024 * 1024))}MB`}
          {maxFiles && ` · Máximo ${maxFiles} archivos`}
        </p>
      </div>
      
      {errors.length > 0 && (
        <div className="mt-2">
          {errors.map((error, index) => (
            <p key={index} className="text-sm text-red-500">{error}</p>
          ))}
        </div>
      )}
      
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">Archivos seleccionados ({selectedFiles.length})</p>
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
              <div className="flex items-center space-x-2 truncate">
                <span className="text-sm truncate">{file.name}</span>
                <span className="text-xs text-gray-500">({Math.round(file.size / 1024)} KB)</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile(index);
                }}
                className="h-7 w-7"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 