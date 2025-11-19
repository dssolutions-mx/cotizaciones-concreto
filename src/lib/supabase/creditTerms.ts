import { supabase as browserClient } from './client';
import { createServerSupabaseClient } from './server';
import { handleError } from '@/utils/errorHandler';
import { financialService } from './financial';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ClientCreditTerms {
  id: string;
  client_id: string;
  credit_limit: number | null;
  pagare_amount: number | null;
  pagare_expiry_date: string | null;
  payment_frequency_days: number | null;
  grace_period_days: number | null;
  payment_instrument_type: 'pagare_2_a_1' | 'garantia_prendaria' | 'contrato' | 'cheque_post_fechado' | 'visto_bueno_direccion' | null;
  notes: string | null;
  effective_date: string;
  is_active: boolean;
  status: 'draft' | 'pending_validation' | 'active' | 'terminated';
  validated_by: string | null;
  validated_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditDocument {
  id: string;
  client_id: string;
  document_type: 'pagare' | 'contract' | 'credit_application' | 'other';
  file_name: string;
  file_url: string;
  document_amount: number | null;
  expiry_date: string | null;
  verification_status: 'pending' | 'verified' | 'expired' | 'rejected';
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  uploaded_by: string | null;
  upload_date: string;
  created_at: string;
  updated_at: string;
}

export interface CreditTermsHistory {
  id: string;
  client_id: string;
  previous_limit: number | null;
  new_limit: number;
  change_reason: string | null;
  document_reference: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface CreditStatus {
  client_id: string;
  has_terms: boolean;
  credit_limit: number;
  current_balance: number;
  credit_available: number;
  utilization_percentage: number;
  status: 'healthy' | 'warning' | 'critical' | 'over_limit';
  payment_frequency_days: number | null;
  last_payment_date: string | null;
  days_since_last_payment: number | null;
  is_overdue: boolean;
}

export interface PaymentComplianceInfo {
  client_id: string;
  current_balance: number; // Positive = owes money, Negative = has credit
  last_payment_date: string | null;
  expected_frequency_days: number | null;
  days_since_last_payment: number | null;
  grace_period_days: number | null;
  is_overdue: boolean;
  days_overdue: number | null;
  next_expected_payment: string | null;
  compliance_status: 'on_track' | 'approaching_due' | 'overdue' | 'in_credit' | 'current' | 'no_terms';
  has_outstanding_balance: boolean; // True if balance > 0
}

interface UpsertCreditTermsData {
  client_id: string;
  credit_limit?: number | null;
  pagare_amount?: number | null;
  pagare_expiry_date?: string | null;
  payment_frequency_days?: number | null;
  grace_period_days?: number | null;
  payment_instrument_type?: 'pagare_2_a_1' | 'garantia_prendaria' | 'contrato' | 'cheque_post_fechado' | 'visto_bueno_direccion' | null;
  notes?: string | null;
  effective_date?: string;
  status?: 'draft' | 'pending_validation' | 'active' | 'terminated';
}

// ============================================================================
// CREDIT TERMS CRUD OPERATIONS
// ============================================================================

/**
 * Get active credit terms for a client (only returns terms with status = 'active')
 */
export async function getClientCreditTerms(
  clientId: string,
  useServerClient = false
): Promise<ClientCreditTerms | null> {
  try {
    const client = useServerClient ? await createServerSupabaseClient() : browserClient;

    const { data, error } = await client
      .from('client_credit_terms')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - client has no active credit terms yet
        return null;
      }
      throw error;
    }

    return data as ClientCreditTerms;
  } catch (error) {
    console.error('Error fetching client credit terms:', error);
    handleError(error, 'Failed to fetch client credit terms');
    return null;
  }
}

/**
 * Get all credit terms for a client (including historical)
 */
export async function getAllClientCreditTerms(
  clientId: string,
  useServerClient = false
): Promise<ClientCreditTerms[]> {
  try {
    const client = useServerClient ? await createServerSupabaseClient() : browserClient;

    const { data, error } = await client
      .from('client_credit_terms')
      .select('*')
      .eq('client_id', clientId)
      .order('effective_date', { ascending: false });

    if (error) throw error;

    return data as ClientCreditTerms[];
  } catch (error) {
    console.error('Error fetching all client credit terms:', error);
    handleError(error, 'Failed to fetch client credit terms history');
    return [];
  }
}

/**
 * Get latest credit terms for a client (including pending/draft status)
 * Useful for showing pending validation status to sales agents
 */
export async function getLatestClientCreditTerms(
  clientId: string,
  useServerClient = false
): Promise<ClientCreditTerms | null> {
  try {
    const client = useServerClient ? await createServerSupabaseClient() : browserClient;

    const { data, error } = await client
      .from('client_credit_terms')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as ClientCreditTerms | null;
  } catch (error) {
    console.error('Error fetching latest client credit terms:', error);
    handleError(error, 'Failed to fetch latest client credit terms');
    return null;
  }
}

/**
 * Create or update credit terms for a client
 * Status is determined by user role:
 * - Sales agents: 'pending_validation' (needs validator approval)
 * - Validators/Executives: 'active' (immediately active)
 * If terms exist, deactivates old terms and creates new terms
 */
export async function upsertCreditTerms(
  termsData: UpsertCreditTermsData,
  userId: string,
  userRole?: string,
  useServerClient = false
): Promise<{ success: boolean; data?: ClientCreditTerms; error?: string }> {
  try {
    const client = useServerClient ? await createServerSupabaseClient() : browserClient;
    const { client_id, status, ...updateData } = termsData;

    // Determine status based on user role if not explicitly provided
    let finalStatus: 'draft' | 'pending_validation' | 'active' | 'terminated' = status || 'pending_validation';
    
    if (!status) {
      // Sales agents create pending_validation, others create active
      if (userRole === 'SALES_AGENT' || userRole === 'EXTERNAL_SALES_AGENT') {
        finalStatus = 'pending_validation';
      } else if (['EXECUTIVE', 'CREDIT_VALIDATOR', 'ADMIN_OPERATIONS'].includes(userRole || '')) {
        finalStatus = 'active';
      }
    }

    // Start a transaction-like operation
    // First, check if active terms exist
    const existingTerms = await getClientCreditTerms(client_id, useServerClient);

    if (existingTerms && finalStatus === 'active') {
      // Deactivate existing active terms when creating new active ones
      const { error: deactivateError } = await client
        .from('client_credit_terms')
        .update({ 
          is_active: false,
          status: 'terminated'
        })
        .eq('id', existingTerms.id);

      if (deactivateError) throw deactivateError;
    }

    // Insert new terms
    const { data, error } = await client
      .from('client_credit_terms')
      .insert({
        client_id,
        ...updateData,
        status: finalStatus,
        is_active: finalStatus === 'active', // Only active if status is 'active'
        created_by: userId,
        effective_date: updateData.effective_date || new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: data as ClientCreditTerms,
    };
  } catch (error: any) {
    console.error('Error upserting credit terms:', error);
    return {
      success: false,
      error: error.message || 'Failed to save credit terms',
    };
  }
}

/**
 * Get all credit terms pending validation (for credit validators)
 */
export async function getPendingValidationCreditTerms(
  useServerClient = false
): Promise<ClientCreditTerms[]> {
  try {
    const client = useServerClient ? await createServerSupabaseClient() : browserClient;

    const { data, error } = await client
      .from('client_credit_terms')
      .select('*')
      .eq('status', 'pending_validation')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data as ClientCreditTerms[];
  } catch (error) {
    console.error('Error fetching pending validation credit terms:', error);
    handleError(error, 'Failed to fetch pending credit terms');
    return [];
  }
}

/**
 * Approve and activate credit terms (for credit validators)
 * Adds pagaré information and activates the credit terms
 */
export async function approveCreditTerms(
  termsId: string,
  validatorId: string,
  pagareData: {
    pagare_amount?: number | null;
    pagare_expiry_date?: string | null;
  },
  useServerClient = false
): Promise<{ success: boolean; data?: ClientCreditTerms; error?: string }> {
  try {
    const client = useServerClient ? await createServerSupabaseClient() : browserClient;

    // Get existing terms
    const { data: existingTerms, error: fetchError } = await client
      .from('client_credit_terms')
      .select('*')
      .eq('id', termsId)
      .single();

    if (fetchError) throw fetchError;

    if (existingTerms.status !== 'pending_validation') {
      return {
        success: false,
        error: 'Credit terms are not pending validation',
      };
    }

    // Deactivate any existing active terms for this client
    const { data: activeTerms } = await client
      .from('client_credit_terms')
      .select('id')
      .eq('client_id', existingTerms.client_id)
      .eq('status', 'active')
      .single();

    if (activeTerms) {
      await client
        .from('client_credit_terms')
        .update({ 
          is_active: false,
          status: 'terminated'
        })
        .eq('id', activeTerms.id);
    }

    // Update terms to active with pagaré info
    const { data, error } = await client
      .from('client_credit_terms')
      .update({
        status: 'active',
        is_active: true,
        pagare_amount: pagareData.pagare_amount || existingTerms.pagare_amount,
        pagare_expiry_date: pagareData.pagare_expiry_date || existingTerms.pagare_expiry_date,
        validated_by: validatorId,
        validated_at: new Date().toISOString(),
      })
      .eq('id', termsId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: data as ClientCreditTerms,
    };
  } catch (error: any) {
    console.error('Error approving credit terms:', error);
    return {
      success: false,
      error: error.message || 'Failed to approve credit terms',
    };
  }
}

/**
 * Delete/terminate credit terms for a client
 * This deactivates the active terms (soft delete) to maintain history
 */
export async function deleteCreditTerms(
  clientId: string,
  userId: string,
  useServerClient = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = useServerClient ? await createServerSupabaseClient() : browserClient;

    // Get active terms
    const activeTerms = await getClientCreditTerms(clientId, useServerClient);

    if (!activeTerms) {
      return {
        success: false,
        error: 'No active credit terms found to delete',
      };
    }

    // Deactivate the terms (soft delete to maintain history)
    const { error } = await client
      .from('client_credit_terms')
      .update({ is_active: false })
      .eq('id', activeTerms.id);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting credit terms:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete credit terms',
    };
  }
}

/**
 * Get credit terms change history for a client
 */
export async function getCreditTermsHistory(
  clientId: string,
  useServerClient = false
): Promise<CreditTermsHistory[]> {
  try {
    const client = useServerClient ? await createServerSupabaseClient() : browserClient;

    const { data, error } = await client
      .from('credit_terms_history')
      .select('*')
      .eq('client_id', clientId)
      .order('changed_at', { ascending: false });

    if (error) throw error;

    return data as CreditTermsHistory[];
  } catch (error) {
    console.error('Error fetching credit terms history:', error);
    handleError(error, 'Failed to fetch credit terms history');
    return [];
  }
}

// ============================================================================
// CREDIT STATUS CALCULATIONS
// ============================================================================

/**
 * Calculate comprehensive credit status for a client
 * Returns credit limit, balance, available credit, and utilization
 */
export async function getCreditStatus(
  clientId: string,
  useServerClient = false
): Promise<CreditStatus> {
  try {
    // Get credit terms and current balance in parallel
    const [creditTerms, balanceData, paymentHistory] = await Promise.all([
      getClientCreditTerms(clientId, useServerClient),
      getClientBalance(clientId, useServerClient),
      getLastPaymentDate(clientId, useServerClient),
    ]);

    const creditLimit = creditTerms?.credit_limit || 0;
    const currentBalance = balanceData || 0;
    const creditAvailable = Math.max(creditLimit - currentBalance, 0);
    const utilizationPercentage =
      creditLimit > 0 ? (currentBalance / creditLimit) * 100 : 0;

    // Determine status based on utilization
    let status: CreditStatus['status'];
    if (currentBalance > creditLimit) {
      status = 'over_limit';
    } else if (utilizationPercentage >= 90) {
      status = 'critical';
    } else if (utilizationPercentage >= 70) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    // Calculate days since last payment
    let daysSinceLastPayment: number | null = null;
    let isOverdue = false;

    if (paymentHistory && creditTerms?.payment_frequency_days) {
      const lastPaymentDate = new Date(paymentHistory);
      const today = new Date();
      const diffTime = today.getTime() - lastPaymentDate.getTime();
      daysSinceLastPayment = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      const gracePeriod = creditTerms.grace_period_days || 0;
      const expectedPaymentCycle = creditTerms.payment_frequency_days + gracePeriod;
      isOverdue = daysSinceLastPayment > expectedPaymentCycle;
    }

    return {
      client_id: clientId,
      has_terms: !!creditTerms,
      credit_limit: creditLimit,
      current_balance: currentBalance,
      credit_available: creditAvailable,
      utilization_percentage: utilizationPercentage,
      status,
      payment_frequency_days: creditTerms?.payment_frequency_days || null,
      last_payment_date: paymentHistory,
      days_since_last_payment: daysSinceLastPayment,
      is_overdue: isOverdue,
    };
  } catch (error) {
    console.error('Error calculating credit status:', error);
    // Return safe defaults
    return {
      client_id: clientId,
      has_terms: false,
      credit_limit: 0,
      current_balance: 0,
      credit_available: 0,
      utilization_percentage: 0,
      status: 'healthy',
      payment_frequency_days: null,
      last_payment_date: null,
      days_since_last_payment: null,
      is_overdue: false,
    };
  }
}

/**
 * Get payment compliance information for a client
 * This function considers the client's current balance:
 * - Positive balance = client owes money (debt)
 * - Negative balance = client has credit (overpaid)
 * - Zero balance = client is current
 */
export async function getPaymentComplianceInfo(
  clientId: string,
  useServerClient = false
): Promise<PaymentComplianceInfo> {
  try {
    const [creditTerms, lastPayment, currentBalance] = await Promise.all([
      getClientCreditTerms(clientId, useServerClient),
      getLastPaymentDate(clientId, useServerClient),
      getClientBalance(clientId, useServerClient),
    ]);

    const expectedFrequencyDays = creditTerms?.payment_frequency_days || null;
    const gracePeriodDays = creditTerms?.grace_period_days || 0;
    const hasOutstandingBalance = currentBalance > 0;

    // If no credit terms configured, return early
    if (!expectedFrequencyDays) {
      return {
        client_id: clientId,
        current_balance: currentBalance,
        last_payment_date: lastPayment,
        expected_frequency_days: null,
        days_since_last_payment: null,
        grace_period_days: null,
        is_overdue: false,
        days_overdue: null,
        next_expected_payment: null,
        compliance_status: 'no_terms',
        has_outstanding_balance: hasOutstandingBalance,
      };
    }

    // If client has negative balance (credit/overpaid), they don't owe anything
    if (currentBalance < 0) {
      return {
        client_id: clientId,
        current_balance: currentBalance,
        last_payment_date: lastPayment,
        expected_frequency_days: expectedFrequencyDays,
        days_since_last_payment: null, // Not meaningful when in credit
        grace_period_days: gracePeriodDays,
        is_overdue: false,
        days_overdue: null,
        next_expected_payment: null, // No payment expected when in credit
        compliance_status: 'in_credit',
        has_outstanding_balance: false,
      };
    }

    // If balance is zero, client is current
    if (currentBalance === 0) {
      return {
        client_id: clientId,
        current_balance: currentBalance,
        last_payment_date: lastPayment,
        expected_frequency_days: expectedFrequencyDays,
        days_since_last_payment: lastPayment ? Math.floor((Date.now() - new Date(lastPayment).getTime()) / (1000 * 60 * 60 * 24)) : null,
        grace_period_days: gracePeriodDays,
        is_overdue: false,
        days_overdue: null,
        next_expected_payment: null, // No payment expected until balance goes positive
        compliance_status: 'current',
        has_outstanding_balance: false,
      };
    }

    // Client has positive balance (owes money) - calculate payment compliance
    let daysSinceLastPayment: number | null = null;
    let isOverdue = false;
    let daysOverdue: number | null = null;
    let nextExpectedPayment: string | null = null;
    let complianceStatus: PaymentComplianceInfo['compliance_status'] = 'on_track';

    if (lastPayment) {
      const lastPaymentDate = new Date(lastPayment);
      const today = new Date();
      const diffTime = today.getTime() - lastPaymentDate.getTime();
      daysSinceLastPayment = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // Calculate next expected payment based on payment frequency
      const nextPaymentDate = new Date(lastPaymentDate);
      nextPaymentDate.setDate(nextPaymentDate.getDate() + expectedFrequencyDays);
      nextExpectedPayment = nextPaymentDate.toISOString().split('T')[0];

      // Check if overdue (including grace period)
      const allowedDays = expectedFrequencyDays + gracePeriodDays;
      if (daysSinceLastPayment > allowedDays) {
        isOverdue = true;
        daysOverdue = daysSinceLastPayment - allowedDays;
        complianceStatus = 'overdue';
      } else if (daysSinceLastPayment > expectedFrequencyDays * 0.8) {
        // Approaching due date (80% of payment cycle)
        complianceStatus = 'approaching_due';
      } else {
        complianceStatus = 'on_track';
      }
    } else {
      // No payment history but has outstanding balance
      // Consider them overdue if balance exists and no payment recorded
      // This handles edge cases where balance exists but no payment history
      complianceStatus = 'approaching_due';
    }

    return {
      client_id: clientId,
      current_balance: currentBalance,
      last_payment_date: lastPayment,
      expected_frequency_days: expectedFrequencyDays,
      days_since_last_payment: daysSinceLastPayment,
      grace_period_days: gracePeriodDays,
      is_overdue: isOverdue,
      days_overdue: daysOverdue,
      next_expected_payment: nextExpectedPayment,
      compliance_status: complianceStatus,
      has_outstanding_balance: hasOutstandingBalance,
    };
  } catch (error) {
    console.error('Error getting payment compliance info:', error);
    return {
      client_id: clientId,
      current_balance: 0,
      last_payment_date: null,
      expected_frequency_days: null,
      days_since_last_payment: null,
      grace_period_days: null,
      is_overdue: false,
      days_overdue: null,
      next_expected_payment: null,
      compliance_status: 'no_terms',
      has_outstanding_balance: false,
    };
  }
}

/**
 * Get credit status for multiple clients (batch)
 */
export async function getBatchCreditStatus(
  clientIds: string[],
  useServerClient = false
): Promise<CreditStatus[]> {
  try {
    // Process in batches to avoid overwhelming the system
    const batchSize = 10;
    const results: CreditStatus[] = [];

    for (let i = 0; i < clientIds.length; i += batchSize) {
      const batch = clientIds.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((id) => getCreditStatus(id, useServerClient))
      );
      results.push(...batchResults);
    }

    return results;
  } catch (error) {
    console.error('Error getting batch credit status:', error);
    return [];
  }
}

// ============================================================================
// DOCUMENT MANAGEMENT
// ============================================================================

/**
 * Get all documents for a client
 */
export async function getClientDocuments(
  clientId: string,
  documentType?: CreditDocument['document_type'],
  useServerClient = false
): Promise<CreditDocument[]> {
  try {
    const client = useServerClient ? await createServerSupabaseClient() : browserClient;

    let query = client
      .from('client_credit_documents')
      .select('*')
      .eq('client_id', clientId)
      .order('upload_date', { ascending: false });

    if (documentType) {
      query = query.eq('document_type', documentType);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data as CreditDocument[];
  } catch (error) {
    console.error('Error fetching client documents:', error);
    handleError(error, 'Failed to fetch client documents');
    return [];
  }
}

/**
 * Upload a credit document
 */
export async function uploadCreditDocument(
  file: File,
  metadata: {
    client_id: string;
    document_type: CreditDocument['document_type'];
    document_amount?: number;
    expiry_date?: string;
    notes?: string;
    uploaded_by: string;
  },
  useServerClient = false
): Promise<{ success: boolean; data?: CreditDocument; error?: string }> {
  try {
    const client = useServerClient ? await createServerSupabaseClient() : browserClient;

    // Generate unique file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${metadata.client_id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Upload file to storage
    const { data: uploadData, error: uploadError } = await client.storage
      .from('credit-documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // For private buckets, use the file path (not public URL)
    // The file_url will be used to generate signed URLs when needed
    const fileUrl = fileName;

    // Insert document record
    const { data: docData, error: docError } = await client
      .from('client_credit_documents')
      .insert({
        client_id: metadata.client_id,
        document_type: metadata.document_type,
        file_name: file.name,
        file_url: fileUrl, // Store the path, not a URL
        document_amount: metadata.document_amount || null,
        expiry_date: metadata.expiry_date || null,
        notes: metadata.notes || null,
        uploaded_by: metadata.uploaded_by,
        verification_status: 'pending',
      })
      .select()
      .single();

    if (docError) throw docError;

    return {
      success: true,
      data: docData as CreditDocument,
    };
  } catch (error: any) {
    console.error('Error uploading credit document:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload document',
    };
  }
}

/**
 * Update document verification status
 */
export async function updateDocumentStatus(
  documentId: string,
  status: CreditDocument['verification_status'],
  verifiedBy: string,
  useServerClient = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = useServerClient ? await createServerSupabaseClient() : browserClient;

    const { error } = await client
      .from('client_credit_documents')
      .update({
        verification_status: status,
        verified_by: verifiedBy,
        verified_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error updating document status:', error);
    return {
      success: false,
      error: error.message || 'Failed to update document status',
    };
  }
}

/**
 * Delete a credit document
 */
export async function deleteCreditDocument(
  documentId: string,
  useServerClient = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = useServerClient ? await createServerSupabaseClient() : browserClient;

    // Get document to find file path
    const { data: doc, error: fetchError } = await client
      .from('client_credit_documents')
      .select('file_url')
      .eq('id', documentId)
      .single();

    if (fetchError) throw fetchError;

    // Extract file path from URL
    const urlParts = doc.file_url.split('/');
    const filePath = urlParts.slice(-2).join('/'); // client_id/filename

    // Delete from storage
    const { error: storageError } = await client.storage
      .from('credit-documents')
      .remove([filePath]);

    if (storageError) throw storageError;

    // Delete record
    const { error: deleteError } = await client
      .from('client_credit_documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) throw deleteError;

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting credit document:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete document',
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get client's current balance from client_balances table
 */
async function getClientBalance(
  clientId: string,
  useServerClient = false
): Promise<number> {
  try {
    const client = useServerClient ? await createServerSupabaseClient() : browserClient;

    const { data, error } = await client
      .from('client_balances')
      .select('current_balance')
      .eq('client_id', clientId)
      .is('construction_site', null) // General balance only
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No balance record found
        return 0;
      }
      throw error;
    }

    return data?.current_balance || 0;
  } catch (error) {
    console.error('Error fetching client balance:', error);
    return 0;
  }
}

/**
 * Get last payment date for a client
 */
async function getLastPaymentDate(
  clientId: string,
  useServerClient = false
): Promise<string | null> {
  try {
    const client = useServerClient ? await createServerSupabaseClient() : browserClient;

    const { data, error } = await client
      .from('client_payments')
      .select('payment_date')
      .eq('client_id', clientId)
      .order('payment_date', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No payments found
        return null;
      }
      throw error;
    }

    return data?.payment_date || null;
  } catch (error) {
    console.error('Error fetching last payment date:', error);
    return null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const creditTermsService = {
  // CRUD operations
  getClientCreditTerms,
  getAllClientCreditTerms,
  getLatestClientCreditTerms,
  upsertCreditTerms,
  deleteCreditTerms,
  getCreditTermsHistory,
  getPendingValidationCreditTerms,
  approveCreditTerms,

  // Credit status calculations
  getCreditStatus,
  getPaymentComplianceInfo,
  getBatchCreditStatus,

  // Document management
  getClientDocuments,
  uploadCreditDocument,
  updateDocumentStatus,
  deleteCreditDocument,
};
