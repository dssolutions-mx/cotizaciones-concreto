/**
 * Debug Controls for Session Management
 * 
 * These utilities help debug session management issues by providing
 * controls to disable specific features during testing.
 */

declare global {
  interface Window {
    __DEBUG_SESSION_MGMT__?: {
      disableCrossTabSync: boolean;
      enableVerboseLogging: boolean;
      simulateSessionExpiry: boolean;
    };
    __DISABLE_CROSS_TAB_SYNC__?: boolean;
  }
}

export interface SessionDebugControls {
  disableCrossTabSync: boolean;
  enableVerboseLogging: boolean;
  simulateSessionExpiry: boolean;
  disableEventDeduplication: boolean;
  showEventStats: boolean;
}

/**
 * Initialize debug controls
 */
export function initializeDebugControls(): void {
  if (typeof window === 'undefined') return;
  
  window.__DEBUG_SESSION_MGMT__ = window.__DEBUG_SESSION_MGMT__ || {
    disableCrossTabSync: false,
    enableVerboseLogging: false,
    simulateSessionExpiry: false,
    disableEventDeduplication: false,
    showEventStats: false,
  };
  
  // Sync the legacy flag for backwards compatibility
  window.__DISABLE_CROSS_TAB_SYNC__ = window.__DEBUG_SESSION_MGMT__.disableCrossTabSync;
}

/**
 * Get current debug settings
 */
export function getDebugControls(): SessionDebugControls {
  if (typeof window === 'undefined') {
    return {
      disableCrossTabSync: false,
      enableVerboseLogging: false,
      simulateSessionExpiry: false,
      disableEventDeduplication: false,
      showEventStats: false,
    };
  }
  
  return window.__DEBUG_SESSION_MGMT__ || {
    disableCrossTabSync: false,
    enableVerboseLogging: false,
    simulateSessionExpiry: false,
    disableEventDeduplication: false,
    showEventStats: false,
  };
}

/**
 * Update debug settings
 */
export function setDebugControls(controls: Partial<SessionDebugControls>): void {
  if (typeof window === 'undefined') return;
  
  window.__DEBUG_SESSION_MGMT__ = {
    ...getDebugControls(),
    ...controls,
  };
  
  // Sync the legacy flag
  window.__DISABLE_CROSS_TAB_SYNC__ = window.__DEBUG_SESSION_MGMT__.disableCrossTabSync;
  
  console.log('[SessionDebug] Updated controls:', window.__DEBUG_SESSION_MGMT__);
}

/**
 * Console utilities for debugging session issues
 */
export const sessionDebugUtils = {
  /**
   * Disable cross-tab synchronization
   */
  disableCrossTabSync(): void {
    setDebugControls({ disableCrossTabSync: true });
    console.log('🔧 Cross-tab sync disabled. Open new tabs to test isolated session management.');
  },
  
  /**
   * Enable cross-tab synchronization
   */
  enableCrossTabSync(): void {
    setDebugControls({ disableCrossTabSync: false });
    console.log('🔧 Cross-tab sync enabled. State will sync across tabs.');
  },
  
  /**
   * Enable verbose logging for session events
   */
  enableVerboseLogging(): void {
    setDebugControls({ enableVerboseLogging: true });
    console.log('🔧 Verbose session logging enabled.');
  },
  
  /**
   * Disable verbose logging
   */
  disableVerboseLogging(): void {
    setDebugControls({ enableVerboseLogging: false });
    console.log('🔧 Verbose session logging disabled.');
  },
  
  /**
   * Simulate session expiry for testing
   */
  simulateExpiry(): void {
    setDebugControls({ simulateSessionExpiry: true });
    console.log('🔧 Session expiry simulation enabled. Visibility changes will trigger re-authentication.');
  },
  
  /**
   * Stop simulating session expiry
   */
  stopSimulatingExpiry(): void {
    setDebugControls({ simulateSessionExpiry: false });
    console.log('🔧 Session expiry simulation disabled.');
  },
  
  /**
   * Get current settings
   */
  status(): void {
    const controls = getDebugControls();
    console.table(controls);
  },
  
  /**
   * Disable event deduplication for testing
   */
  disableEventDeduplication(): void {
    setDebugControls({ disableEventDeduplication: true });
    console.log('🔧 Event deduplication disabled. Events will not be deduplicated.');
  },
  
  /**
   * Enable event deduplication
   */
  enableEventDeduplication(): void {
    setDebugControls({ disableEventDeduplication: false });
    console.log('🔧 Event deduplication enabled.');
  },
  
  /**
   * Show event statistics
   */
  showEventStats(): void {
    setDebugControls({ showEventStats: true });
    if (typeof window !== 'undefined' && (window as any).eventDeduplicationService) {
      const stats = (window as any).eventDeduplicationService.getStats();
      console.table(stats);
    } else {
      console.log('🔧 Event deduplication service not available');
    }
  },
  
  /**
   * Show render performance statistics
   */
  showRenderStats(): void {
    if (typeof window !== 'undefined' && (window as any).renderStats) {
      const summary = (window as any).renderStats.summary();
      console.log('📊 Render Performance Summary:');
      console.table(summary);
      
      const components = (window as any).renderStats.components();
      console.log('📊 Component Statistics:');
      console.table(components);
    } else {
      console.log('🔧 Render tracking not available');
    }
  },
  
  /**
   * Run quick performance test
   */
  runQuickTest(): void {
    if (typeof window !== 'undefined' && (window as any).sessionTesting) {
      console.log('🧪 Running quick performance test...');
      (window as any).sessionTesting.quickTest().then((result: any) => {
        console.log('🎯 Quick test completed:', result);
      });
    } else {
      console.log('🔧 Session testing utilities not available');
    }
  },
  
  /**
   * Enable performance monitoring
   */
  enablePerformanceMonitoring(): void {
    if (typeof window !== 'undefined') {
      if ((window as any).renderTracker) {
        (window as any).renderTracker.setEnabled(true);
      }
      
      console.log('📊 Performance monitoring enabled');
      console.log('Use sessionDebug.showRenderStats() to view results');
    }
  },
  
  /**
   * Disable performance monitoring
   */
  disablePerformanceMonitoring(): void {
    if (typeof window !== 'undefined') {
      if ((window as any).renderTracker) {
        (window as any).renderTracker.setEnabled(false);
      }
      
      console.log('📊 Performance monitoring disabled');
    }
  },
  
  /**
   * Hide event statistics
   */
  hideEventStats(): void {
    setDebugControls({ showEventStats: false });
    console.log('🔧 Event statistics hidden.');
  },

  /**
   * Reset all debug settings
   */
  reset(): void {
    setDebugControls({
      disableCrossTabSync: false,
      enableVerboseLogging: false,
      simulateSessionExpiry: false,
      disableEventDeduplication: false,
      showEventStats: false,
    });
    console.log('🔧 All debug controls reset to defaults.');
  }
};

// Make utilities available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).sessionDebug = sessionDebugUtils;
  console.log('🔧 Session debug utilities available via window.sessionDebug');
  console.log('Available commands:');
  console.log('• Auth: disableCrossTabSync(), enableVerboseLogging(), simulateExpiry()');
  console.log('• Events: disableEventDeduplication(), showEventStats()');
  console.log('• Performance: enablePerformanceMonitoring(), showRenderStats()');
  console.log('• Testing: runQuickTest()');
  console.log('• General: status(), reset()');
}

// Initialize on import
initializeDebugControls();
