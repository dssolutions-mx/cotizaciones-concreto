import { supabase } from '@/lib/supabase';
import { UserRole } from '@/contexts/AuthContext';

// Verify Supabase environment variables
function verifySupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error(`Supabase configuration error: ${!url ? 'URL' : 'Key'} is missing`);
  }
}

interface CreateUserData {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  callerId?: string;
  callerEmail?: string;
}

// Try to verify config once at module load time
try {
  verifySupabaseConfig();
} catch (e) {
  console.error('Supabase configuration error:', e);
}

export const authService = {
  /**
   * Crea un nuevo usuario con rol específico
   */
  async createUser({
    email,
    password,
    firstName,
    lastName,
    role,
    callerId,
    callerEmail,
  }: CreateUserData) {
    try {
      // Verificar config antes de hacer la solicitud
      verifySupabaseConfig();
      
      // Try to get current user info if not provided
      if (!callerId || !callerEmail) {
        try {
          const { data } = await supabase.auth.getUser();
          if (data?.user) {
            callerId = callerId || data.user.id;
            callerEmail = callerEmail || data.user.email;
            console.log('Retrieved current user for auth:', callerId);
          }
        } catch (e) {
          console.warn('Could not get current user auth info:', e);
        }
      }
      
      // Llamar a la API route en lugar de la función admin directamente
      const response = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          role,
          callerId,
          callerEmail,
        }),
        // Importante: incluir las credenciales para que las cookies se envíen
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response from create-user API:', errorData);
        throw new Error(errorData.error || `Error al crear usuario (${response.status})`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        console.error('Unsuccessful response from create-user API:', data);
        throw new Error(data.error || 'Error al crear usuario');
      }

      return data.user;
    } catch (error) {
      console.error('Error in createUser function:', error);
      throw error;
    }
  },

  /**
   * Actualiza el rol de un usuario existente
   */
  async updateUserRole(userId: string, role: UserRole) {
    const { error } = await supabase
      .from('user_profiles')
      .update({ role })
      .eq('id', userId);

    if (error) throw error;
  },

  /**
   * Obtiene todos los usuarios con sus perfiles
   */
  async getAllUsers() {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data;
  },

  /**
   * Desactivar una cuenta de usuario
   */
  async deactivateUser(userId: string) {
    // Esta operación debería realizarse a través de una API route
    // Por ahora, lo marcamos en los metadatos
    const { error } = await supabase
      .from('user_profiles')
      .update({
        is_active: false
      })
      .eq('id', userId);

    if (error) throw error;
  },

  /**
   * Reactivar una cuenta de usuario
   */
  async reactivateUser(userId: string) {
    // Esta operación debería realizarse a través de una API route
    // Por ahora, lo marcamos en los metadatos
    const { error } = await supabase
      .from('user_profiles')
      .update({
        is_active: true
      })
      .eq('id', userId);

    if (error) throw error;
  },

  /**
   * Actualiza el perfil del usuario con manejo de sesión mejorado
   */
  async updateUserProfile(userId: string, profileData: {
    first_name?: string;
    last_name?: string;
    email?: string;
    role?: UserRole;
  }) {
    let attempts = 0;
    const maxAttempts = 3;
    let lastError = null;
    
    while (attempts < maxAttempts) {
      try {
        // Attempt to update user profile
        const { error } = await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('id', userId);
          
        if (!error) {
          console.log('User profile updated successfully');
          
          // Manually refresh session after profile update
          try {
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              console.warn('Session refresh after profile update failed:', refreshError);
            } else {
              console.log('Session refreshed after profile update');
            }
          } catch (refreshErr) {
            console.warn('Error refreshing session after profile update:', refreshErr);
          }
          
          return { success: true };
        }
        
        // If there was an error, log it and retry
        console.error(`Profile update attempt ${attempts + 1}/${maxAttempts} failed:`, error);
        lastError = error;
        attempts++;
        
        if (attempts < maxAttempts) {
          // Wait before retrying (increasing delay with each attempt)
          const delay = 500 * attempts;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (err) {
        console.error(`Unexpected error in profile update attempt ${attempts + 1}:`, err);
        lastError = err;
        attempts++;
        
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempts));
        }
      }
    }
    
    // If we reached here, all attempts failed
    throw lastError || new Error('Failed to update user profile after multiple attempts');
  },

  /**
   * Enviar invitación por correo electrónico a un nuevo usuario
   */
  async inviteUser(email: string, role: UserRole, callerId?: string, callerEmail?: string) {
    try {
      // Verify config before making the request
      verifySupabaseConfig();
      
      // Try to get current user info if not provided
      if (!callerId || !callerEmail) {
        try {
          const { data } = await supabase.auth.getUser();
          if (data?.user) {
            callerId = callerId || data.user.id;
            callerEmail = callerEmail || data.user.email;
            console.log('Retrieved current user for invite:', callerId);
          }
        } catch (e) {
          console.warn('Could not get current user info for invite:', e);
        }
      }
      
      // Llamar a la API route en lugar de la función admin directamente
      const response = await fetch('/api/auth/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          role,
          callerId,
          callerEmail,
        }),
        // Importante: incluir las credenciales para que las cookies se envíen
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response from invite-user API:', errorData);
        throw new Error(errorData.error || `Error al invitar usuario (${response.status})`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        console.error('Unsuccessful response from invite-user API:', data);
        throw new Error(data.error || 'Error al invitar usuario');
      }

      return data.user;
    } catch (error) {
      console.error('Error in inviteUser:', error);
      throw error;
    }
  }
}; 