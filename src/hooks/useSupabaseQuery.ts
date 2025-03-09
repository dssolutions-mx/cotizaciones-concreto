import { useState, useEffect } from 'react';

// Sistema de caché simple en memoria
const queryCache = new Map<string, { data: unknown; timestamp: number }>();

interface QueryOptions<T> {
  cacheTime?: number;
  enabled?: boolean;
  refetchInterval?: number | false;
  onSuccess?: (data: T) => void;
  onError?: (error: unknown) => void;
}

/**
 * Hook personalizado para realizar consultas a Supabase con caché
 * @param key - Clave única para identificar la consulta en caché
 * @param queryFn - Función asíncrona que realiza la consulta a Supabase
 * @param options - Opciones de configuración
 */
export function useSupabaseQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  options: QueryOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);
  
  const {
    cacheTime = 5 * 60 * 1000, // 5 minutos por defecto
    enabled = true,
    refetchInterval = false,
    onSuccess,
    onError
  } = options;
  
  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;
    
    const fetchData = async () => {
      if (!enabled) return;
      
      try {
        setIsLoading(true);
        
        // Verificar si hay datos en caché
        const cachedItem = queryCache.get(key);
        if (cachedItem && (Date.now() - cachedItem.timestamp < cacheTime)) {
          if (isMounted) {
            setData(cachedItem.data as T);
            setIsLoading(false);
          }
          return cachedItem.data as T;
        }
        
        // Ejecutar consulta
        const result = await queryFn();
        
        // Guardar en caché
        queryCache.set(key, {
          data: result,
          timestamp: Date.now()
        });
        
        if (isMounted) {
          setData(result);
          setError(null);
          setIsLoading(false);
        }
        
        // Ejecutar callback de éxito
        if (onSuccess) {
          onSuccess(result);
        }
        
        return result;
      } catch (err) {
        if (isMounted) {
          setError(err);
          setIsLoading(false);
        }
        
        // Ejecutar callback de error
        if (onError) {
          onError(err);
        }
        
        console.error('Error en consulta:', err);
        return null;
      }
    };
    
    // Realizar la consulta inicial
    fetchData();
    
    // Configurar refetch automático si está habilitado
    if (refetchInterval) {
      intervalId = setInterval(fetchData, refetchInterval);
    }
    
    // Limpiar al desmontar
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [key, queryFn, cacheTime, enabled, refetchInterval, onSuccess, onError]);
  
  // Función para refrescar manualmente los datos
  const refetch = async () => {
    // Eliminar de caché
    queryCache.delete(key);
    setIsLoading(true);
    
    try {
      const result = await queryFn();
      queryCache.set(key, {
        data: result,
        timestamp: Date.now()
      });
      
      setData(result);
      setError(null);
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (err) {
      setError(err);
      
      if (onError) {
        onError(err);
      }
      
      console.error('Error en refetch:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Función para limpiar la caché
  const clearCache = () => {
    queryCache.delete(key);
  };
  
  return { data, isLoading, error, refetch, clearCache };
} 