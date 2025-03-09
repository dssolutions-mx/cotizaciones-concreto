/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase';

export const logQuoteChange = async (
  quoteId: string,
  changeType: string,
  changes: Record<string, any>
) => {
  try {
    // Get current authenticated user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    let userId = null;
    
    if (userError) {
      console.warn('Error getting authenticated user for logging:', userError);
    } else {
      userId = userData.user?.id || null;
    }
    
    const { error } = await supabase
      .from('quote_change_history')
      .insert([{
        quote_id: quoteId,
        changed_by: userId,
        change_type: changeType,
        changes: changes
      }]);

    if (error) console.error('Error en logger:', error);
  } catch (err) {
    console.error('Error en sistema de logging:', err);
  }
}; 