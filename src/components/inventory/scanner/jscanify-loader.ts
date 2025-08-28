import { JScanifyLoadResult } from './scanner-types';
import { opencvLoader } from './opencv-loader';

/**
 * Handles loading and initialization of jscanify library
 * Ensures OpenCV is loaded first, then initializes jscanify properly
 */
export class JScanifyLoader {
  private static instance: JScanifyLoader;
  private isLoaded = false;
  private isLoading = false;
  private loadPromise: Promise<JScanifyLoadResult> | null = null;

  static getInstance(): JScanifyLoader {
    if (!JScanifyLoader.instance) {
      JScanifyLoader.instance = new JScanifyLoader();
    }
    return JScanifyLoader.instance;
  }

  /**
   * Check if jscanify is already available
   */
  isJScanifyAvailable(): boolean {
    return typeof window !== 'undefined' &&
           typeof window.jscanify !== 'undefined' &&
           window.jscanify !== null;
  }

  /**
   * Load jscanify with proper OpenCV dependency
   */
  async load(): Promise<JScanifyLoadResult> {
    if (this.isLoaded && this.isJScanifyAvailable()) {
      return { success: true };
    }

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this.loadJScanify();

    try {
      const result = await this.loadPromise;
      this.isLoaded = result.success;
      return result;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Internal method to load jscanify from multiple CDN sources
   */
  private async loadJScanify(): Promise<JScanifyLoadResult> {
    // Ensure OpenCV is loaded first
    console.log('🔄 Ensuring OpenCV is loaded before jscanify...');
    const opencvResult = await opencvLoader.load();

    if (!opencvResult.success) {
      return {
        success: false,
        error: `OpenCV loading failed: ${opencvResult.error}`
      };
    }

    if (this.isJScanifyAvailable()) {
      console.log('✅ jscanify is already available');
      return { success: true };
    }

    const jscanifyUrls = [
      'https://cdn.jsdelivr.net/gh/puffinsoft/jscanify@master/src/jscanify.min.js',
      'https://cdn.jsdelivr.net/gh/ColonelParrot/jscanify@master/src/jscanify.min.js',
      'https://unpkg.com/jscanify@1.4.0/src/jscanify.min.js',
      'https://raw.githubusercontent.com/ColonelParrot/jscanify/master/src/jscanify.min.js',
    ];

    for (const url of jscanifyUrls) {
      try {
        console.log(`🔄 Loading jscanify from: ${url}`);
        await this.loadScript(url);
        const initResult = await this.waitForJScanifyInitialization(10000); // 10 second timeout

        if (initResult.success) {
          console.log(`✅ jscanify loaded successfully from: ${url}`);
          return initResult;
        }
      } catch (error) {
        console.warn(`❌ Failed to load jscanify from ${url}:`, error);
      }
    }

    return {
      success: false,
      error: 'Failed to load jscanify from any CDN source'
    };
  }

  /**
   * Load a script dynamically
   */
  private loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;

      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));

      document.head.appendChild(script);
    });
  }

  /**
   * Wait for jscanify to be fully initialized
   */
  private waitForJScanifyInitialization(timeoutMs: number): Promise<JScanifyLoadResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkJScanify = () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('jscanify initialization timeout'));
          return;
        }

        if (this.isJScanifyAvailable()) {
          try {
            // Test jscanify functionality
            const Scanner = window.jscanify;
            const testScanner = new Scanner();

            console.log('🔍 Checking jscanify methods...', Object.getOwnPropertyNames(testScanner));

            // Check if scanner has any useful methods
            const methods = Object.getOwnPropertyNames(testScanner).concat(
              Object.getOwnPropertyNames(Object.getPrototypeOf(testScanner))
            );

            const hasDetectionMethods = methods.some(method =>
              method.toLowerCase().includes('paper') ||
              method.toLowerCase().includes('document') ||
              method.toLowerCase().includes('extract') ||
              method.toLowerCase().includes('find') ||
              method.toLowerCase().includes('detect') ||
              method.toLowerCase().includes('highlight')
            );

            if (hasDetectionMethods || methods.length > 0) {
              console.log('✅ jscanify has detection methods:', methods);
              resolve({
                success: true,
                version: this.getJScanifyVersion()
              });
            } else {
              console.warn('⚠️ jscanify loaded but no detection methods found');
              reject(new Error('jscanify loaded but missing detection methods'));
            }
          } catch (error) {
            console.error('❌ jscanify test error:', error);
            reject(error);
          }
        } else {
          setTimeout(checkJScanify, 200); // Check every 200ms
        }
      };

      checkJScanify();
    });
  }

  /**
   * Get jscanify version information
   */
  private getJScanifyVersion(): string {
    try {
      // jscanify doesn't expose version info directly
      // We'll return a generic version string
      return 'jscanify-latest';
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Test jscanify functionality - based on Scanbot tutorial approach
   */
  async testJScanify(): Promise<boolean> {
    if (!this.isJScanifyAvailable()) {
      console.warn('⚠️ jscanify not available');
      return false;
    }

    try {
      // Test basic jscanify operations - following Scanbot tutorial pattern
      const Scanner = window.jscanify;
      const scanner = new Scanner();

      console.log('🧪 Testing jscanify scanner instance...');

      // Check for essential methods that Scanbot tutorial uses
      const hasExtractPaper = typeof scanner.extractPaper === 'function';
      const hasFindPaperContour = typeof scanner.findPaperContour === 'function';
      const hasHighlightPaper = typeof scanner.highlightPaper === 'function';

      console.log('🔍 Method availability:', {
        extractPaper: hasExtractPaper,
        findPaperContour: hasFindPaperContour,
        highlightPaper: hasHighlightPaper
      });

      // If jscanify doesn't have the methods we need, disable it
      if (!hasExtractPaper || !hasFindPaperContour || !hasHighlightPaper) {
        console.warn('⚠️ jscanify missing essential methods, will use OpenCV fallback');
        this.scanner = null; // Disable jscanify
        return false;
      }

      // Store the working scanner instance
      this.scanner = scanner;
      console.log('✅ jscanify test passed - all methods available');
      return true;

    } catch (error) {
      console.error('❌ jscanify test failed:', error);
      this.scanner = null; // Disable on error
      return false;
    }
  }

  /**
   * Create a new scanner instance following the working example pattern
   */
  createScanner(): any {
    if (!this.isJScanifyAvailable()) {
      console.warn('jscanify not available, cannot create scanner');
      return null;
    }

    try {
      // Follow the working example pattern - simple scanner creation
      const scanner = new window.jscanify();

      // Validate that the scanner has the essential methods
      if (typeof scanner.extractPaper !== 'function' ||
          typeof scanner.findPaperContour !== 'function' ||
          typeof scanner.highlightPaper !== 'function') {
        console.error('Scanner missing essential methods');
        return null;
      }

      console.log('✅ Scanner instance created successfully with all required methods');
      return scanner;
    } catch (error) {
      console.error('Failed to create scanner instance:', error);
      return null;
    }
  }

  /**
   * Clean up jscanify resources (call when component unmounts)
   */
  cleanup(): void {
    this.isLoaded = false;
    this.isLoading = false;
    this.loadPromise = null;
  }
}

// Export singleton instance
export const jscanifyLoader = JScanifyLoader.getInstance();
