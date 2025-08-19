/**
 * Event Deduplication Service
 * 
 * Provides centralized event management with deduplication, throttling,
 * and intelligent event routing to prevent cascade effects.
 */

export interface EventContext {
  source: string;
  timestamp: number;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface EventEntry {
  id: string;
  type: string;
  context: EventContext;
  signature: string;
  count: number;
  lastSeen: number;
  firstSeen: number;
}

export interface EventStats {
  totalEvents: number;
  uniqueEvents: number;
  duplicatesBlocked: number;
  deduplicationRate: number;
  topEventTypes: Array<{ type: string; count: number }>;
}

export type EventHandler<T = any> = (data: T, context: EventContext) => void | Promise<void>;

export interface EventDeduplicationOptions {
  dedupeWindow?: number; // Time window for deduplication in milliseconds
  maxEventHistory?: number; // Maximum events to keep in history
  enableMetrics?: boolean; // Enable performance metrics
  throttleMs?: number; // Throttle similar events
}

export class EventDeduplicationService {
  private events = new Map<string, EventEntry>();
  private handlers = new Map<string, Set<EventHandler>>();
  private stats = {
    totalEvents: 0,
    duplicatesBlocked: 0,
    uniqueEvents: 0,
  };
  
  private options: Required<EventDeduplicationOptions>;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: EventDeduplicationOptions = {}) {
    this.options = {
      dedupeWindow: options.dedupeWindow ?? 5000, // 5 seconds
      maxEventHistory: options.maxEventHistory ?? 1000,
      enableMetrics: options.enableMetrics ?? true,
      throttleMs: options.throttleMs ?? 1000, // 1 second
    };

    this.startCleanupTimer();
  }

  /**
   * Register event handler for specific event type
   */
  on<T = any>(eventType: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    
    this.handlers.get(eventType)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * Emit event with deduplication
   */
  emit<T = any>(eventType: string, data: T, context: Partial<EventContext> = {}): boolean {
    const now = Date.now();
    const fullContext: EventContext = {
      source: 'unknown',
      timestamp: now,
      ...context,
    };

    this.stats.totalEvents++;

    // Create event signature for deduplication
    const signature = this.createEventSignature(eventType, data, fullContext);
    const existingEvent = this.events.get(signature);

    // Check for duplicates within deduplication window
    if (existingEvent && (now - existingEvent.lastSeen) < this.options.dedupeWindow) {
      existingEvent.count++;
      existingEvent.lastSeen = now;
      this.stats.duplicatesBlocked++;
      
      if (this.options.enableMetrics) {
        console.log(`[EventDedup] Blocked duplicate ${eventType} (${existingEvent.count} times)`);
      }
      
      return false; // Event was deduplicated
    }

    // Check for throttling
    if (existingEvent && (now - existingEvent.lastSeen) < this.options.throttleMs) {
      if (this.options.enableMetrics) {
        console.log(`[EventDedup] Throttled ${eventType}`);
      }
      return false; // Event was throttled
    }

    // Store/update event entry
    const eventEntry: EventEntry = existingEvent ? {
      ...existingEvent,
      count: existingEvent.count + 1,
      lastSeen: now,
    } : {
      id: this.generateEventId(),
      type: eventType,
      context: fullContext,
      signature,
      count: 1,
      lastSeen: now,
      firstSeen: now,
    };

    this.events.set(signature, eventEntry);
    
    if (!existingEvent) {
      this.stats.uniqueEvents++;
    }

    // Emit to handlers
    const handlers = this.handlers.get(eventType);
    if (handlers && handlers.size > 0) {
      handlers.forEach(handler => {
        try {
          handler(data, fullContext);
        } catch (error) {
          console.error(`[EventDedup] Handler error for ${eventType}:`, error);
        }
      });
    }

    if (this.options.enableMetrics) {
      console.log(`[EventDedup] Emitted ${eventType} (${eventEntry.count} total)`);
    }

    return true; // Event was emitted
  }

  /**
   * Check if event would be deduplicated without emitting
   */
  wouldDeduplicate<T = any>(eventType: string, data: T, context: Partial<EventContext> = {}): boolean {
    const now = Date.now();
    const fullContext: EventContext = {
      source: 'unknown',
      timestamp: now,
      ...context,
    };

    const signature = this.createEventSignature(eventType, data, fullContext);
    const existingEvent = this.events.get(signature);

    return existingEvent && (now - existingEvent.lastSeen) < this.options.dedupeWindow;
  }

  /**
   * Get event statistics
   */
  getStats(): EventStats {
    const eventTypes = new Map<string, number>();
    
    for (const event of this.events.values()) {
      eventTypes.set(event.type, (eventTypes.get(event.type) || 0) + event.count);
    }

    const topEventTypes = Array.from(eventTypes.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));

    return {
      totalEvents: this.stats.totalEvents,
      uniqueEvents: this.stats.uniqueEvents,
      duplicatesBlocked: this.stats.duplicatesBlocked,
      deduplicationRate: this.stats.duplicatesBlocked / this.stats.totalEvents || 0,
      topEventTypes,
    };
  }

  /**
   * Get event history for specific type
   */
  getEventHistory(eventType?: string): EventEntry[] {
    const events = Array.from(this.events.values());
    
    if (eventType) {
      return events.filter(event => event.type === eventType);
    }
    
    return events.sort((a, b) => b.lastSeen - a.lastSeen);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.events.clear();
    this.stats = {
      totalEvents: 0,
      duplicatesBlocked: 0,
      uniqueEvents: 0,
    };
    console.log('[EventDedup] Event history cleared');
  }

  /**
   * Remove all event handlers
   */
  removeAllHandlers(): void {
    this.handlers.clear();
    console.log('[EventDedup] All event handlers removed');
  }

  /**
   * Create signature for event deduplication
   */
  private createEventSignature<T>(eventType: string, data: T, context: EventContext): string {
    // Create a signature that captures the essence of the event
    const sigComponents = [
      eventType,
      context.source,
      context.userId || 'anonymous',
      context.sessionId || 'no-session',
    ];

    // For certain event types, include data in signature
    if (eventType.includes('auth') || eventType.includes('session')) {
      sigComponents.push(JSON.stringify(data).slice(0, 100)); // Limit size
    }

    return sigComponents.join('|');
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  /**
   * Cleanup old events
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - (this.options.dedupeWindow * 2); // Keep events for 2x dedupe window
    let cleanedCount = 0;

    for (const [signature, event] of this.events.entries()) {
      if (event.lastSeen < cutoff) {
        this.events.delete(signature);
        cleanedCount++;
      }
    }

    // Enforce max event history
    if (this.events.size > this.options.maxEventHistory) {
      const events = Array.from(this.events.entries())
        .sort(([, a], [, b]) => a.lastSeen - b.lastSeen); // Oldest first
      
      const excessCount = this.events.size - this.options.maxEventHistory;
      for (let i = 0; i < excessCount; i++) {
        this.events.delete(events[i][0]);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0 && this.options.enableMetrics) {
      console.log(`[EventDedup] Cleaned up ${cleanedCount} old events`);
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.dedupeWindow);
  }

  /**
   * Destroy service and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.events.clear();
    this.handlers.clear();
  }
}

// Global event service instance
export const eventDeduplicationService = new EventDeduplicationService({
  dedupeWindow: 3000, // 3 seconds
  maxEventHistory: 500,
  enableMetrics: process.env.NODE_ENV === 'development',
  throttleMs: 800, // 800ms throttle
});

// Pre-configured auth event helpers
export const AuthEvents = {
  SIGN_IN: 'auth:sign_in',
  SIGN_OUT: 'auth:sign_out',
  TOKEN_REFRESH: 'auth:token_refresh',
  PROFILE_LOAD: 'auth:profile_load',
  SESSION_EXPIRED: 'auth:session_expired',
  VISIBILITY_CHANGE: 'auth:visibility_change',
  TAB_SYNC: 'auth:tab_sync',
} as const;

// Development utilities
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).eventDeduplicationService = eventDeduplicationService;
  console.log('🔧 Event deduplication service available via window.eventDeduplicationService');
}
