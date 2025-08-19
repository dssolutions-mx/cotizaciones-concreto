/**
 * E2E Testing Utilities for Session Management
 * 
 * Provides automated testing capabilities for multi-tab scenarios,
 * load testing, and performance validation.
 */

export interface TabTestResult {
  tabId: string;
  success: boolean;
  duration: number;
  error?: string;
  renderCount: number;
  authEvents: number;
  cacheHits: number;
}

export interface LoadTestResult {
  totalTabs: number;
  successfulTabs: number;
  failedTabs: number;
  averageRenderTime: number;
  totalAuthEvents: number;
  deduplicationRate: number;
  peakMemoryUsage: number;
  testDuration: number;
  results: TabTestResult[];
}

export interface MultiTabTestOptions {
  numberOfTabs?: number;
  testDurationMs?: number;
  actionInterval?: number;
  enablePerformanceMonitoring?: boolean;
  logVerbose?: boolean;
}

export class SessionTestingUtils {
  private isTestRunning = false;
  private testStartTime = 0;
  private tabResults: TabTestResult[] = [];

  /**
   * Run multi-tab session management test
   */
  async runMultiTabTest(options: MultiTabTestOptions = {}): Promise<LoadTestResult> {
    const {
      numberOfTabs = 5,
      testDurationMs = 30000, // 30 seconds
      actionInterval = 2000, // 2 seconds
      enablePerformanceMonitoring = true,
      logVerbose = false,
    } = options;

    if (this.isTestRunning) {
      throw new Error('Test is already running');
    }

    this.isTestRunning = true;
    this.testStartTime = Date.now();
    this.tabResults = [];

    console.log(`🧪 Starting multi-tab test with ${numberOfTabs} tabs for ${testDurationMs}ms`);

    try {
      // Enable performance monitoring
      if (enablePerformanceMonitoring) {
        this.enableTestingMode();
      }

      // Create tabs and run concurrent tests
      const tabPromises = Array.from({ length: numberOfTabs }, (_, index) => 
        this.runSingleTabTest(
          `tab-${index}`,
          testDurationMs,
          actionInterval,
          logVerbose
        )
      );

      const results = await Promise.allSettled(tabPromises);
      
      // Process results
      const successfulResults: TabTestResult[] = [];
      const failedResults: TabTestResult[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulResults.push(result.value);
        } else {
          failedResults.push({
            tabId: `tab-${index}`,
            success: false,
            duration: testDurationMs,
            error: result.reason.message,
            renderCount: 0,
            authEvents: 0,
            cacheHits: 0,
          });
        }
      });

      // Calculate performance metrics
      const loadTestResult = this.calculateLoadTestResults(
        numberOfTabs,
        testDurationMs,
        [...successfulResults, ...failedResults]
      );

      console.log('🎯 Multi-tab test completed:', loadTestResult);
      return loadTestResult;

    } finally {
      this.isTestRunning = false;
      if (enablePerformanceMonitoring) {
        this.disableTestingMode();
      }
    }
  }

  /**
   * Run test for a single tab
   */
  private async runSingleTabTest(
    tabId: string,
    durationMs: number,
    actionInterval: number,
    verbose: boolean
  ): Promise<TabTestResult> {
    const startTime = Date.now();
    let renderCount = 0;
    let authEvents = 0;
    let cacheHits = 0;
    let error: string | undefined;

    try {
      // Simulate tab actions
      const actionCount = Math.floor(durationMs / actionInterval);
      
      for (let i = 0; i < actionCount; i++) {
        await this.simulateTabAction(tabId, i);
        
        // Collect metrics
        if (typeof window !== 'undefined') {
          renderCount += this.getRenderCountForTab(tabId);
          authEvents += this.getAuthEventsForTab(tabId);
          cacheHits += this.getCacheHitsForTab(tabId);
        }
        
        if (verbose) {
          console.log(`[${tabId}] Action ${i + 1}/${actionCount} completed`);
        }
        
        await this.sleep(actionInterval);
      }

    } catch (e: any) {
      error = e.message;
    }

    const duration = Date.now() - startTime;

    return {
      tabId,
      success: !error,
      duration,
      error,
      renderCount,
      authEvents,
      cacheHits,
    };
  }

  /**
   * Simulate typical tab actions
   */
  private async simulateTabAction(tabId: string, actionIndex: number): Promise<void> {
    const actions = [
      () => this.simulateVisibilityChange(tabId),
      () => this.simulateAuthStateCheck(tabId),
      () => this.simulatePageNavigation(tabId),
      () => this.simulateSessionRefresh(tabId),
    ];

    const actionType = actionIndex % actions.length;
    await actions[actionType]();
  }

  /**
   * Simulate visibility change event
   */
  private async simulateVisibilityChange(tabId: string): Promise<void> {
    if (typeof window !== 'undefined') {
      // Simulate tab becoming hidden then visible
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });
      
      document.dispatchEvent(new Event('visibilitychange'));
      
      await this.sleep(100);
      
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      });
      
      document.dispatchEvent(new Event('visibilitychange'));
    }
  }

  /**
   * Simulate auth state check
   */
  private async simulateAuthStateCheck(tabId: string): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).unifiedAuthStore) {
      const store = (window as any).unifiedAuthStore;
      const state = store.getState();
      
      // Trigger hasRole check
      if (state.hasRole) {
        state.hasRole('EXECUTIVE');
      }
    }
  }

  /**
   * Simulate page navigation
   */
  private async simulatePageNavigation(tabId: string): Promise<void> {
    // Simulate component mounting/unmounting by triggering auth bridge
    if (typeof window !== 'undefined' && (window as any).unifiedAuthBridge) {
      const bridge = (window as any).unifiedAuthBridge;
      bridge.useUnifiedAuthBridge();
    }
  }

  /**
   * Simulate session refresh
   */
  private async simulateSessionRefresh(tabId: string): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).unifiedAuthStore) {
      const store = (window as any).unifiedAuthStore;
      const state = store.getState();
      
      if (state.refreshSessionNow) {
        // Don't actually refresh, just simulate the call
        console.log(`[${tabId}] Simulated session refresh`);
      }
    }
  }

  /**
   * Get render count for specific tab
   */
  private getRenderCountForTab(tabId: string): number {
    if (typeof window !== 'undefined' && (window as any).renderTracker) {
      const stats = (window as any).renderTracker.getSummary();
      return stats.totalRenders || 0;
    }
    return 0;
  }

  /**
   * Get auth events for specific tab
   */
  private getAuthEventsForTab(tabId: string): number {
    if (typeof window !== 'undefined' && (window as any).eventDeduplicationService) {
      const stats = (window as any).eventDeduplicationService.getStats();
      return stats.totalEvents || 0;
    }
    return 0;
  }

  /**
   * Get cache hits for specific tab
   */
  private getCacheHitsForTab(tabId: string): number {
    if (typeof window !== 'undefined' && (window as any).authCache) {
      const stats = (window as any).authCache.getStats();
      return stats.totalHits || 0;
    }
    return 0;
  }

  /**
   * Calculate final load test results
   */
  private calculateLoadTestResults(
    totalTabs: number,
    testDuration: number,
    results: TabTestResult[]
  ): LoadTestResult {
    const successfulTabs = results.filter(r => r.success).length;
    const failedTabs = results.filter(r => !r.success).length;
    
    const averageRenderTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const totalAuthEvents = results.reduce((sum, r) => sum + r.authEvents, 0);
    
    // Calculate deduplication rate
    const expectedEvents = totalTabs * 10; // Rough estimate
    const deduplicationRate = Math.max(0, (expectedEvents - totalAuthEvents) / expectedEvents);
    
    return {
      totalTabs,
      successfulTabs,
      failedTabs,
      averageRenderTime,
      totalAuthEvents,
      deduplicationRate,
      peakMemoryUsage: this.getMemoryUsage(),
      testDuration,
      results,
    };
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    if (typeof window !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Enable testing mode across all systems
   */
  private enableTestingMode(): void {
    if (typeof window !== 'undefined') {
      // Enable verbose logging
      if ((window as any).sessionDebug) {
        (window as any).sessionDebug.enableVerboseLogging();
      }
      
      // Enable render tracking
      if ((window as any).renderTracker) {
        (window as any).renderTracker.setEnabled(true);
      }
      
      console.log('🔧 Testing mode enabled');
    }
  }

  /**
   * Disable testing mode
   */
  private disableTestingMode(): void {
    if (typeof window !== 'undefined') {
      // Reset debug settings
      if ((window as any).sessionDebug) {
        (window as any).sessionDebug.reset();
      }
      
      console.log('🔧 Testing mode disabled');
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stress test with many concurrent tabs
   */
  async runStressTest(maxTabs = 20): Promise<LoadTestResult> {
    console.log(`🚀 Running stress test with up to ${maxTabs} tabs`);
    
    return this.runMultiTabTest({
      numberOfTabs: maxTabs,
      testDurationMs: 60000, // 1 minute
      actionInterval: 1000, // 1 second
      enablePerformanceMonitoring: true,
      logVerbose: false,
    });
  }

  /**
   * Quick validation test
   */
  async runQuickValidation(): Promise<LoadTestResult> {
    console.log('⚡ Running quick validation test');
    
    return this.runMultiTabTest({
      numberOfTabs: 3,
      testDurationMs: 10000, // 10 seconds
      actionInterval: 1000, // 1 second
      enablePerformanceMonitoring: true,
      logVerbose: true,
    });
  }
}

// Global testing instance
export const sessionTestingUtils = new SessionTestingUtils();

// Development utilities
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).sessionTesting = {
    quickTest: () => sessionTestingUtils.runQuickValidation(),
    multiTabTest: (tabs = 5) => sessionTestingUtils.runMultiTabTest({ numberOfTabs: tabs }),
    stressTest: (maxTabs = 20) => sessionTestingUtils.runStressTest(maxTabs),
    utils: sessionTestingUtils,
  };
  
  console.log('🧪 Session testing utilities available:');
  console.log('- window.sessionTesting.quickTest(): Run quick validation');
  console.log('- window.sessionTesting.multiTabTest(5): Run multi-tab test');
  console.log('- window.sessionTesting.stressTest(20): Run stress test');
}
