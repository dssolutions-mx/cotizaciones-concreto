import { handleError } from '@/utils/errorHandler';

interface FetchRemisionesOptions {
  excludeBombeo?: boolean;
}

/**
 * Obtiene las remisiones asociadas a una orden
 * @param orderId - ID de la orden
 * @param options - Opciones de filtrado
 * @returns Lista de remisiones
 */
export async function fetchRemisionesByOrder(orderId: string, options: FetchRemisionesOptions = {}) {
  try {
    const { excludeBombeo = false } = options;
    
    // Construir parámetros de consulta
    const params = new URLSearchParams();
    params.append('orderId', orderId);
    if (excludeBombeo) {
      params.append('excludeBombeo', 'true');
    }
    
    const response = await fetch(`/api/remisiones?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error al obtener remisiones: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return handleError(error, 'Error al obtener remisiones');
  }
}

/**
 * Obtiene los detalles de una remisión específica
 * @param id - ID de la remisión
 * @returns Detalles de la remisión
 */
export async function fetchRemisionById(id: string) {
  try {
    const response = await fetch(`/api/remisiones/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error al obtener remisión: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return handleError(error, 'Error al obtener remisión');
  }
}

/**
 * Obtiene las remisiones disponibles para muestreos
 * @returns Lista de remisiones disponibles
 */
export async function fetchRemisionesDisponibles() {
  try {
    const response = await fetch('/api/remisiones/disponibles', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error al obtener remisiones disponibles: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return handleError(error, 'Error al obtener remisiones disponibles');
  }
} 