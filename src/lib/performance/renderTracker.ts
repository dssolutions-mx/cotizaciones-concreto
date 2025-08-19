/**
 * React Render Performance Tracker
 * 
 * Tracks component re-renders, identifies performance bottlenecks,
 * and provides real-time monitoring capabilities.
 */

export interface RenderEvent {
  componentName: string;
  timestamp: number;
  reason: string;
  duration?: number;
  props?: Record<string, any>;
  context?: Record<string, any>;
}

export interface ComponentStats {
  name: string;
  totalRenders: number;
  averageRenderTime: number;
  lastRender: number;
  renders: RenderEvent[];
  unnecessaryRenders: number;
}

export interface RenderTrackerOptions {
  enableTracking?: boolean;
  maxEvents?: number;
  trackProps?: boolean;
  highlightUnnecessary?: boolean;
  consoleLogging?: boolean;
}

export class RenderTracker {
  private events: RenderEvent[] = [];
  private componentStats = new Map<string, ComponentStats>();
  private options: Required<RenderTrackerOptions>;

  constructor(options: RenderTrackerOptions = {}) {
    this.options = {
      enableTracking: options.enableTracking ?? (process.env.NODE_ENV === 'development'),
      maxEvents: options.maxEvents ?? 1000,
      trackProps: options.trackProps ?? false,
      highlightUnnecessary: options.highlightUnnecessary ?? true,
      consoleLogging: options.consoleLogging ?? false,
    };
  }

  /**
   * Track a component render
   */
  trackRender(
    componentName: string,
    reason: string = 'unknown',
    props?: Record<string, any>,
    context?: Record<string, any>
  ): () => void {
    if (!this.options.enableTracking) {
      return () => {};
    }

    const startTime = performance.now();
    const timestamp = Date.now();

    const event: RenderEvent = {
      componentName,
      timestamp,
      reason,
      props: this.options.trackProps ? props : undefined,
      context,
    };

    // Return a function to mark render complete
    return () => {
      const duration = performance.now() - startTime;
      event.duration = duration;

      this.events.push(event);
      this.updateComponentStats(event);

      // Cleanup old events
      if (this.events.length > this.options.maxEvents) {
        this.events = this.events.slice(-this.options.maxEvents);
      }

      // Console logging if enabled
      if (this.options.consoleLogging) {
        const unnecessary = this.isUnnecessaryRender(event);
        const prefix = unnecessary ? '🔴' : '✅';
        
        console.log(
          `${prefix} [RenderTracker] ${componentName} rendered: ${reason} (${duration.toFixed(2)}ms)`,
          context || {}
        );
      }
    };
  }

  /**
   * Update component statistics
   */
  private updateComponentStats(event: RenderEvent): void {
    const stats = this.componentStats.get(event.componentName);
    
    if (stats) {
      stats.totalRenders++;
      stats.lastRender = event.timestamp;
      stats.renders.push(event);
      
      // Keep only recent renders
      if (stats.renders.length > 50) {
        stats.renders = stats.renders.slice(-50);
      }
      
      // Calculate average render time
      const renderTimes = stats.renders
        .filter(r => r.duration !== undefined)
        .map(r => r.duration!);
      
      if (renderTimes.length > 0) {
        stats.averageRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      }
      
      // Check for unnecessary renders
      if (this.isUnnecessaryRender(event)) {
        stats.unnecessaryRenders++;
      }
    } else {
      this.componentStats.set(event.componentName, {
        name: event.componentName,
        totalRenders: 1,
        averageRenderTime: event.duration || 0,
        lastRender: event.timestamp,
        renders: [event],
        unnecessaryRenders: this.isUnnecessaryRender(event) ? 1 : 0,
      });
    }
  }

  /**
   * Detect potentially unnecessary renders
   */
  private isUnnecessaryRender(event: RenderEvent): boolean {
    if (!this.options.highlightUnnecessary) return false;

    const stats = this.componentStats.get(event.componentName);
    if (!stats || stats.renders.length < 2) return false;

    const recent = stats.renders.slice(-5); // Last 5 renders
    const rapidRenders = recent.filter(r => 
      event.timestamp - r.timestamp < 1000 // Within 1 second
    ).length;

    // Consider it unnecessary if there are 3+ renders within 1 second
    return rapidRenders >= 3;
  }

  /**
   * Get component performance statistics
   */
  getComponentStats(componentName?: string): ComponentStats | ComponentStats[] {
    if (componentName) {
      return this.componentStats.get(componentName) || {
        name: componentName,
        totalRenders: 0,
        averageRenderTime: 0,
        lastRender: 0,
        renders: [],
        unnecessaryRenders: 0,
      };
    }

    return Array.from(this.componentStats.values()).sort((a, b) => b.totalRenders - a.totalRenders);
  }

  /**
   * Get recent render events
   */
  getRecentRenders(limit: number = 20): RenderEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    totalRenders: number;
    componentsTracked: number;
    averageRenderTime: number;
    topComponents: ComponentStats[];
    unnecessaryRenders: number;
  } {
    const stats = Array.from(this.componentStats.values());
    const totalRenders = stats.reduce((sum, s) => sum + s.totalRenders, 0);
    const totalTime = stats.reduce((sum, s) => sum + (s.averageRenderTime * s.totalRenders), 0);
    const unnecessaryRenders = stats.reduce((sum, s) => sum + s.unnecessaryRenders, 0);

    return {
      totalRenders,
      componentsTracked: stats.length,
      averageRenderTime: totalRenders > 0 ? totalTime / totalRenders : 0,
      topComponents: stats.sort((a, b) => b.totalRenders - a.totalRenders).slice(0, 10),
      unnecessaryRenders,
    };
  }

  /**
   * Clear all tracking data
   */
  clear(): void {
    this.events = [];
    this.componentStats.clear();
  }

  /**
   * Enable/disable tracking
   */
  setEnabled(enabled: boolean): void {
    this.options.enableTracking = enabled;
  }

  /**
   * Export data for analysis
   */
  exportData(): {
    events: RenderEvent[];
    stats: ComponentStats[];
    summary: ReturnType<typeof this.getSummary>;
    timestamp: number;
  } {
    return {
      events: this.events,
      stats: Array.from(this.componentStats.values()),
      summary: this.getSummary(),
      timestamp: Date.now(),
    };
  }
}

// Global tracker instance
export const renderTracker = new RenderTracker({
  enableTracking: process.env.NODE_ENV === 'development',
  maxEvents: 1000,
  trackProps: false, // Can be enabled for detailed debugging
  highlightUnnecessary: true,
  consoleLogging: false, // Can be enabled via debug controls
});

// React hook for tracking component renders
export function useRenderTracker(componentName: string, deps?: any[], context?: Record<string, any>) {
  if (!renderTracker) return;

  const depString = deps ? JSON.stringify(deps) : 'no-deps';
  const reason = `deps: ${depString}`;
  
  const finishRender = renderTracker.trackRender(componentName, reason, undefined, context);
  
  // Mark render complete immediately (since we can't track actual render completion easily)
  React.useEffect(() => {
    finishRender();
  });
}

// Development utilities
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).renderTracker = renderTracker;
  
  (window as any).renderStats = {
    summary: () => {
      const summary = renderTracker.getSummary();
      console.log('📊 Render Performance Summary:');
      console.table(summary);
      return summary;
    },
    components: (name?: string) => {
      const stats = renderTracker.getComponentStats(name);
      if (name) {
        console.log(`📊 Stats for ${name}:`, stats);
      } else {
        console.log('📊 All Component Stats:');
        console.table(stats);
      }
      return stats;
    },
    recent: (limit = 10) => {
      const recent = renderTracker.getRecentRenders(limit);
      console.log(`📊 Recent ${limit} renders:`, recent);
      return recent;
    },
    clear: () => {
      renderTracker.clear();
      console.log('📊 Render tracking data cleared');
    },
    export: () => {
      const data = renderTracker.exportData();
      console.log('📊 Exported render data:', data);
      return data;
    },
  };
  
  console.log('🔧 Render tracking utilities available:');
  console.log('- window.renderStats.summary(): Overall performance summary');
  console.log('- window.renderStats.components(): All component statistics');
  console.log('- window.renderStats.recent(): Recent render events');
  console.log('- window.renderStats.clear(): Clear tracking data');
}

// Import React for the hook
import React from 'react';
