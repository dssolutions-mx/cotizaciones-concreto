import { 
  StagingRemision, 
  RemisionStatus, 
  StatusProcessingAction, 
  StatusProcessingDecision, 
  StatusProcessingResult,
  WasteMaterial,
  RemisionReassignment 
} from '@/types/arkik';

export class ArkikStatusProcessor {
  private plantId: string;
  private sessionId: string;

  constructor(plantId: string, sessionId: string) {
    this.plantId = plantId;
    this.sessionId = sessionId;
  }

  /**
   * Analyzes remisiones and categorizes them by status
   */
  analyzeRemisionStatuses(remisiones: StagingRemision[]): {
    terminados: StagingRemision[];
    incompletos: StagingRemision[];
    cancelados: StagingRemision[];
    pendientes: StagingRemision[];
    unrecognized: StagingRemision[];
  } {
    const terminados: StagingRemision[] = [];
    const incompletos: StagingRemision[] = [];
    const cancelados: StagingRemision[] = [];
    const pendientes: StagingRemision[] = [];
    const unrecognized: StagingRemision[] = [];

    remisiones.forEach(remision => {
      const status = this.normalizeStatus(remision.estatus);
      
      switch (status) {
        case RemisionStatus.TERMINADO:
          terminados.push(remision);
          break;
        case RemisionStatus.TERMINADO_INCOMPLETO:
          incompletos.push(remision);
          break;
        case RemisionStatus.CANCELADO:
          cancelados.push(remision);
          break;
        case RemisionStatus.PENDIENTE:
          pendientes.push(remision);
          break;
        default:
          unrecognized.push(remision);
          break;
      }
    });

    return { terminados, incompletos, cancelados, pendientes, unrecognized };
  }

  /**
   * Detects potential reassignments by looking for similar remisiones
   */
  detectPotentialReassignments(
    problemRemisiones: StagingRemision[], 
    allRemisiones: StagingRemision[]
  ): Map<string, StagingRemision[]> {
    const potentialTargets = new Map<string, StagingRemision[]>();

    problemRemisiones.forEach(problemRemision => {
      const candidates = this.findReassignmentCandidates(problemRemision, allRemisiones);
      if (candidates.length > 0) {
        potentialTargets.set(problemRemision.id, candidates);
      }
    });

    return potentialTargets;
  }

  /**
   * Finds potential reassignment targets for a problematic remision
   */
  private findReassignmentCandidates(
    problemRemision: StagingRemision, 
    allRemisiones: StagingRemision[]
  ): StagingRemision[] {
    return allRemisiones.filter(candidate => {
      // Don't suggest self
      if (candidate.id === problemRemision.id) return false;
      
      // Only suggest completed remisiones
      if (this.normalizeStatus(candidate.estatus) !== RemisionStatus.TERMINADO) return false;

      // Must be same client
      if (candidate.cliente_name !== problemRemision.cliente_name) return false;

      // Must be same construction site
      if (candidate.obra_name !== problemRemision.obra_name) return false;

      // Must be same day or within reasonable timeframe (±2 days)
      const timeDiff = Math.abs(candidate.fecha.getTime() - problemRemision.fecha.getTime());
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      if (daysDiff > 2) return false;

      // Should have similar recipe or product
      if (candidate.recipe_code && problemRemision.recipe_code) {
        if (candidate.recipe_code !== problemRemision.recipe_code) return false;
      }

      return true;
    });
  }

  /**
   * Applies processing decisions to remisiones
   */
  applyProcessingDecisions(
    remisiones: StagingRemision[], 
    decisions: StatusProcessingDecision[]
  ): StatusProcessingResult {
    const result: StatusProcessingResult = {
      total_remisiones: remisiones.length,
      processed_remisiones: 0,
      normal_remisiones: 0,
      reassigned_remisiones: 0,
      waste_remisiones: 0,
      excluded_remisiones: 0,
      decisions: decisions,
      waste_materials: [],
      reassignments: []
    };

    // Create decision map for quick lookup
    const decisionMap = new Map<string, StatusProcessingDecision>();
    decisions.forEach(decision => {
      decisionMap.set(decision.remision_id, decision);
    });

    // Process each remision
    remisiones.forEach(remision => {
      const decision = decisionMap.get(remision.id);
      
      if (!decision) {
        // No explicit decision - apply default logic based on status
        const action = this.getDefaultAction(remision.estatus);
        this.applyAction(remision, action, result);
      } else {
        // Apply explicit decision
        this.applyDecision(remision, decision, result, remisiones);
      }
      
      result.processed_remisiones++;
    });

    return result;
  }

  /**
   * Applies a processing decision to a specific remision
   */
  private applyDecision(
    remision: StagingRemision, 
    decision: StatusProcessingDecision, 
    result: StatusProcessingResult,
    allRemisiones: StagingRemision[]
  ): void {
    switch (decision.action) {
      case StatusProcessingAction.PROCEED_NORMAL:
        remision.status_processing_action = StatusProcessingAction.PROCEED_NORMAL;
        result.normal_remisiones++;
        break;

      case StatusProcessingAction.REASSIGN_TO_EXISTING:
        this.processReassignment(remision, decision, result, allRemisiones);
        break;

      case StatusProcessingAction.MARK_AS_WASTE:
        this.processWaste(remision, decision, result);
        break;


    }
  }

  /**
   * Processes a remision reassignment
   */
  private processReassignment(
    sourceRemision: StagingRemision,
    decision: StatusProcessingDecision,
    result: StatusProcessingResult,
    allRemisiones: StagingRemision[]
  ): void {
    if (!decision.target_remision_number) {
      throw new Error(`Target remision number required for reassignment of ${sourceRemision.remision_number}`);
    }

    // Find target remision
    const targetRemision = allRemisiones.find(r => 
      r.remision_number === decision.target_remision_number
    );

    if (!targetRemision) {
      throw new Error(`Target remision ${decision.target_remision_number} not found`);
    }

    // Create reassignment record
    const reassignment: RemisionReassignment = {
      source_remision_id: sourceRemision.id,
      source_remision_number: sourceRemision.remision_number,
      target_remision_id: targetRemision.id,
      target_remision_number: targetRemision.remision_number,
      materials_to_transfer: decision.materials_to_transfer || sourceRemision.materials_real,
      reason: decision.notes || 'Status processing reassignment',
      created_at: new Date()
    };

    // Add materials to target remision
    Object.entries(reassignment.materials_to_transfer).forEach(([materialCode, amount]) => {
      if (!targetRemision.materials_real[materialCode]) {
        targetRemision.materials_real[materialCode] = 0;
      }
      targetRemision.materials_real[materialCode] += amount;
    });

    // Mark source as excluded (volume = 0, but materials transferred)
    sourceRemision.is_excluded_from_import = true;
    sourceRemision.status_processing_action = StatusProcessingAction.REASSIGN_TO_EXISTING;
    sourceRemision.target_remision_for_reassignment = decision.target_remision_number;
    sourceRemision.volumen_fabricado = 0; // Don't count volume twice

    result.reassignments.push(reassignment);
    result.reassigned_remisiones++;
  }

  /**
   * Processes waste materials
   */
  private processWaste(
    remision: StagingRemision,
    decision: StatusProcessingDecision,
    result: StatusProcessingResult
  ): void {
    // Create waste records for all materials
    Object.entries(remision.materials_real).forEach(([materialCode, actualAmount]) => {
      const theoreticalAmount = remision.materials_teorico[materialCode] || 0;
      
      const wasteRecord: WasteMaterial = {
        id: crypto.randomUUID(),
        session_id: this.sessionId,
        remision_number: remision.remision_number,
        material_code: materialCode,
        theoretical_amount: theoreticalAmount,
        actual_amount: actualAmount,
        waste_amount: actualAmount, // All actual amount becomes waste
        waste_reason: this.getWasteReason(remision.estatus),
        plant_id: this.plantId,
        fecha: remision.fecha,
        created_at: new Date()
      };

      result.waste_materials.push(wasteRecord);
    });

    // Mark remision as waste
    remision.is_excluded_from_import = true;
    remision.status_processing_action = StatusProcessingAction.MARK_AS_WASTE;
    remision.waste_reason = decision.waste_reason;
    remision.status_processing_notes = decision.notes;

    result.waste_remisiones++;
  }

  /**
   * Gets default action based on status
   */
  private getDefaultAction(estatus: string): StatusProcessingAction {
    const normalizedStatus = this.normalizeStatus(estatus);
    
    switch (normalizedStatus) {
      case RemisionStatus.TERMINADO:
        return StatusProcessingAction.PROCEED_NORMAL;
      case RemisionStatus.TERMINADO_INCOMPLETO:
      case RemisionStatus.CANCELADO:
        return StatusProcessingAction.MARK_AS_WASTE; // Default to waste, user can override
      default:
        return StatusProcessingAction.PROCEED_NORMAL;
    }
  }

  /**
   * Applies action without explicit decision
   */
  private applyAction(
    remision: StagingRemision, 
    action: StatusProcessingAction, 
    result: StatusProcessingResult
  ): void {
    const dummyDecision: StatusProcessingDecision = {
      remision_id: remision.id,
      remision_number: remision.remision_number,
      original_status: remision.estatus,
      action: action,
      notes: 'Auto-applied based on status'
    };

    this.applyDecision(remision, dummyDecision, result, []);
  }

  /**
   * Normalizes status string to enum value
   */
  private normalizeStatus(estatus: string): RemisionStatus {
    const normalized = estatus.toLowerCase().trim();
    
    if (normalized.includes('terminado') && normalized.includes('incompleto')) {
      return RemisionStatus.TERMINADO_INCOMPLETO;
    }
    if (normalized.includes('terminado')) {
      return RemisionStatus.TERMINADO;
    }
    if (normalized.includes('cancelado')) {
      return RemisionStatus.CANCELADO;
    }
    if (normalized.includes('pendiente')) {
      return RemisionStatus.PENDIENTE;
    }
    
    // Default to pendiente for unrecognized statuses
    return RemisionStatus.PENDIENTE;
  }

  /**
   * Gets waste reason based on status
   */
  private getWasteReason(estatus: string): 'cancelled' | 'incomplete' | 'quality_issue' | 'other' {
    const normalized = this.normalizeStatus(estatus);
    
    switch (normalized) {
      case RemisionStatus.CANCELADO:
        return 'cancelled';
      case RemisionStatus.TERMINADO_INCOMPLETO:
        return 'incomplete';
      default:
        return 'other';
    }
  }

  /**
   * Validates processing decisions
   */
  validateDecisions(
    decisions: StatusProcessingDecision[], 
    remisiones: StagingRemision[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const remisionMap = new Map(remisiones.map(r => [r.id, r]));

    decisions.forEach(decision => {
      // Check if remision exists
      if (!remisionMap.has(decision.remision_id)) {
        errors.push(`Remision ${decision.remision_number} not found`);
        return;
      }

      // Validate reassignment targets
      if (decision.action === StatusProcessingAction.REASSIGN_TO_EXISTING) {
        if (!decision.target_remision_number) {
          errors.push(`Target remision required for reassignment of ${decision.remision_number}`);
        } else {
          const targetExists = remisiones.some(r => r.remision_number === decision.target_remision_number);
          if (!targetExists) {
            errors.push(`Target remision ${decision.target_remision_number} not found`);
          }
        }
      }

      // Validate waste reasons
      if (decision.action === StatusProcessingAction.MARK_AS_WASTE && !decision.waste_reason) {
        errors.push(`Waste reason required for ${decision.remision_number}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
