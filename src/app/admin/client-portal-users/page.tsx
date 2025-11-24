'use client';

import React, { useState, useEffect, Suspense, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import RoleGuard from '@/components/auth/RoleGuard';
import { Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PortalUsersTable } from '@/components/admin/client-portal/PortalUsersTable';
import { CreatePortalUserModal } from '@/components/admin/client-portal/CreatePortalUserModal';
import { useToast } from '@/components/ui/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { ErrorBoundary } from '@/components/admin/client-portal/ErrorBoundary';
import type { PortalUser } from '@/lib/supabase/clientPortalAdmin';

function ClientPortalUsersContent() {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchingRef = useRef(false);

  // Debounce search term to prevent excessive filtering
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Retry logic helper
  const retryFetch = useCallback(async (
    url: string,
    options: RequestInit,
    maxRetries = 3,
    delay = 1000
  ): Promise<Response> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response;
        }
        // If not the last attempt and not aborted, retry
        if (attempt < maxRetries && !options.signal?.aborted) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
          continue;
        }
        return response;
      } catch (error: any) {
        // Don't retry if aborted
        if (error?.name === 'AbortError') {
          throw error;
        }
        if (attempt === maxRetries) {
          throw error;
        }
        // Don't retry if aborted
        if (options.signal?.aborted) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
    throw new Error('Failed to fetch after retries');
  }, []);

  // Memoize fetchUsers to prevent recreation on every render
  const fetchUsers = useCallback(async (forceRefresh = false) => {
    // Prevent duplicate requests
    if (fetchingRef.current && !forceRefresh) {
      return;
    }

    try {
      fetchingRef.current = true;
      
      // Cancel previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);
      
      const response = await retryFetch('/api/admin/client-portal-users', {
        signal: abortControllerRef.current.signal,
      }, 3, 1000);
      
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al cargar usuarios');
      }

      setUsers(result.data || []);
    } catch (err: unknown) {
      // Don't set error if request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      console.error('Error loading portal users:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar usuarios del portal';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [toast, retryFetch]);

  // Load users on mount
  useEffect(() => {
    fetchUsers();

    // Cleanup: abort request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchUsers]);

  // Memoize filtered users to prevent unnecessary recalculations
  const filteredUsers = useMemo(() => {
    let filtered = users;
    const clientFilter = searchParams.get('clientId');

    // Apply client filter if set
    if (clientFilter) {
      filtered = filtered.filter((user) =>
        user.client_associations.some((assoc) => assoc.client_id === clientFilter)
      );
    }

    // Apply search filter (using debounced term)
    if (debouncedSearchTerm.trim() !== '') {
      const term = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.email.toLowerCase().includes(term) ||
          (user.first_name?.toLowerCase().includes(term) || false) ||
          (user.last_name?.toLowerCase().includes(term) || false) ||
          user.client_associations.some(
            (assoc) =>
              assoc.client_name.toLowerCase().includes(term) ||
              assoc.client_code.toLowerCase().includes(term)
          )
      );
    }

    return filtered;
  }, [users, debouncedSearchTerm, searchParams]);

  // Memoize refresh handler
  const handleRefresh = useCallback(() => {
    fetchUsers(true);
  }, [fetchUsers]);

  // Memoize modal handlers
  const handleCreateModalOpenChange = useCallback((open: boolean) => {
    setCreateModalOpen(open);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    handleRefresh();
  }, [handleRefresh]);

  return (
    <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN_OPERATIONS']} redirectTo="/access-denied">
      <ErrorBoundary>
        <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Usuarios del Portal de Cliente</h1>
            <p className="text-sm text-gray-600 mt-1">
              Gestiona usuarios del portal y sus asociaciones con clientes
            </p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Crear Usuario
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 font-bold"
              aria-label="Cerrar mensaje de error"
            >
              &times;
            </button>
          </div>
        )}

        <div className="mb-4 relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <Input
            type="text"
            placeholder="Buscar por nombre, email o cliente..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full sm:w-72 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <PortalUsersTable
          users={filteredUsers}
          loading={loading}
          onRefresh={handleRefresh}
        />

        <CreatePortalUserModal
          open={createModalOpen}
          onOpenChange={handleCreateModalOpenChange}
          onSuccess={handleCreateSuccess}
        />
        </div>
      </ErrorBoundary>
    </RoleGuard>
  );
}

export default function ClientPortalUsersPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Cargando...</span>
        </div>
      </div>
    }>
      <ClientPortalUsersContent />
    </Suspense>
  );
}

