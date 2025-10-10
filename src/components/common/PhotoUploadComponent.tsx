'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type PhotoUploadComponentProps = {
  bucket?: string;
  prefix?: string; // e.g., order draft id or timestamp prefix
  minFiles?: number; // default 2
  maxFiles?: number; // default 3
  maxFileSizeMB?: number; // default 5
  accept?: string[]; // default ['image/jpeg','image/png']
  onUploaded?: (urls: string[]) => void;
  onError?: (message: string) => void;
  defaultUrls?: string[];
};

export default function PhotoUploadComponent({
  bucket = 'site-validation-evidence',
  prefix,
  minFiles = 2,
  maxFiles = 3,
  maxFileSizeMB = 5,
  accept = ['image/jpeg', 'image/png'],
  onUploaded,
  onError,
  defaultUrls = []
}: PhotoUploadComponentProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>(defaultUrls);
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number[]>([]);

  const canAddMore = useMemo(() => files.length + urls.length < maxFiles, [files.length, urls.length, maxFiles]);

  const handleSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    // Validate quantity
    if (files.length + urls.length + selected.length > maxFiles) {
      onError?.(`Máximo ${maxFiles} fotos`);
      return;
    }

    // Validate types and size
    for (const f of selected) {
      if (!accept.includes(f.type)) {
        onError?.('Solo JPEG o PNG');
        return;
      }
      if (f.size > maxFileSizeMB * 1024 * 1024) {
        onError?.(`Cada foto máximo ${maxFileSizeMB}MB`);
        return;
      }
    }

    // Upload immediately
    try {
      setUploading(true);
      const now = Date.now();
      const newUrls: string[] = [];
      const newProgress: number[] = [...progress];

      for (let i = 0; i < selected.length; i++) {
        const file = selected[i];
        const path = `${prefix || 'draft'}-${now}-${i}-${Math.random().toString(36).slice(2)}.${file.type === 'image/png' ? 'png' : 'jpg'}`;

        // Supabase Storage JS SDK doesn't expose per-chunk progress; we simulate simple stepped progress
        newProgress.push(10);
        setProgress([...newProgress]);

        const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
          cacheControl: '3600',
          upsert: false
        });
        if (error) throw error;

        newProgress[newProgress.length - 1] = 100;
        setProgress([...newProgress]);

        const storagePath = `${bucket}/${data.path}`;
        newUrls.push(storagePath);
      }

      const merged = [...urls, ...newUrls];
      setUrls(merged);
      setFiles([...files, ...selected]);
      onUploaded?.(merged);
    } catch (err: any) {
      console.error('Upload error:', err);
      onError?.('Error al subir fotos. Intente nuevamente.');
    } finally {
      setUploading(false);
    }
  }, [accept, bucket, files, maxFileSizeMB, maxFiles, onError, onUploaded, prefix, progress, urls]);

  const removeUrl = useCallback((index: number) => {
    const next = urls.filter((_, i) => i !== index);
    setUrls(next);
    onUploaded?.(next);
  }, [urls, onUploaded]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          id="photo-input"
          type="file"
          accept={accept.join(',')}
          multiple
          onChange={handleSelect}
          disabled={!canAddMore || uploading}
          className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
        />
        <span className="text-xs text-gray-500">Min {minFiles}, Máx {maxFiles}</span>
      </div>

      {progress.length > 0 && (
        <div className="space-y-1">
          {progress.map((p, idx) => (
            <div key={idx} className="w-full bg-gray-100 rounded">
              <div className="bg-green-600 text-xs leading-4 text-white text-center rounded" style={{ width: `${p}%` }}>{p}%</div>
            </div>
          ))}
        </div>
      )}

      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((u, i) => {
            // Get public URL from Supabase Storage
            const { data } = supabase.storage.from(bucket).getPublicUrl(u.replace(`${bucket}/`, ''));
            return (
              <div key={u} className="relative border rounded overflow-hidden">
                <img src={data.publicUrl} alt="Evidencia" className="w-full h-24 object-cover" />
                <button
                  type="button"
                  onClick={() => removeUrl(i)}
                  className="absolute top-1 right-1 bg-white/80 hover:bg-white text-red-600 rounded px-1 text-xs"
                >Quitar</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


