'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { clientService } from '@/lib/supabase/clients';

interface Props {
  clientId: string;
  businessName?: string;
  logoPath?: string | null;
  onUpdated?: (nextPath: string | null) => void;
}

export default function ClientLogoManager({ clientId, businessName, logoPath, onUpdated }: Props) {
  const [uploading, setUploading] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | null | undefined>(logoPath);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const publicUrl = useMemo(() => {
    if (!currentPath) return null;
    return supabase.storage.from('client-logos').getPublicUrl(currentPath).data.publicUrl;
  }, [currentPath]);

  const handlePick = useCallback(() => inputRef.current?.click(), []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecciona un archivo de imagen');
      return;
    }
    try {
      setUploading(true);
      const ext = file.name.split('.').pop();
      const safeName = (businessName || 'client').toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      const objectPath = `${clientId}/${Date.now()}-${safeName}.${ext}`;

      // Upload to bucket
      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(objectPath, file, { upsert: false, cacheControl: '3600' });
      if (uploadError) throw uploadError;

      // Persist on clients.logo_path
      await clientService.updateClient(clientId, { logo_path: objectPath });

      setCurrentPath(objectPath);
      onUpdated?.(objectPath);
    } catch (err) {
      console.error('Logo upload failed:', err);
      alert('No se pudo subir el logo');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [clientId, businessName, onUpdated]);

  const handleRemove = useCallback(async () => {
    if (!currentPath) return;
    try {
      setUploading(true);
      // Best-effort delete from storage (optional; keep if used elsewhere)
      await supabase.storage.from('client-logos').remove([currentPath]);
      await clientService.updateClient(clientId, { logo_path: null });
      setCurrentPath(null);
      onUpdated?.(null);
    } catch (err) {
      console.error('Logo remove failed:', err);
      alert('No se pudo eliminar el logo');
    } finally {
      setUploading(false);
    }
  }, [clientId, currentPath, onUpdated]);

  return (
    <div className="rounded-xl border p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Logo del Cliente</h3>
        <div className="text-xs text-gray-500">Bucket: client-logos</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-[180px] h-[60px] bg-gray-50 border rounded-lg flex items-center justify-center overflow-hidden">
          {publicUrl ? (
            <Image src={publicUrl} alt="Logo del Cliente" width={180} height={60} className="object-contain" />
          ) : (
            <span className="text-xs text-gray-400">Sin logo</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePick}
            className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-50"
            disabled={uploading}
          >{uploading ? 'Subiendo...' : 'Subir logo'}</button>
          {publicUrl && (
            <button
              type="button"
              onClick={handleRemove}
              className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm"
              disabled={uploading}
            >Eliminar</button>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
      </div>
      {currentPath && (
        <div className="mt-2 text-xs text-gray-500 break-all">{currentPath}</div>
      )}
    </div>
  );
}


