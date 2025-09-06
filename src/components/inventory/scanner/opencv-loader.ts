import { OpenCVLoadResult } from './scanner-types';

/**
 * Handles loading and initialization of OpenCV.js
 * Provides robust fallback URLs and proper initialization checking
 */
export class OpenCVLoader {
  private static instance: OpenCVLoader;
  private isLoaded = false;
  private isLoading = false;
  private loadPromise: Promise<OpenCVLoadResult> | null = null;

  static getInstance(): OpenCVLoader {
    if (!OpenCVLoader.instance) {
      OpenCVLoader.instance = new OpenCVLoader();
    }
    return OpenCVLoader.instance;
  }

  /**
   * Check if OpenCV is already available
   */
  isOpenCVAvailable(): boolean {
    return typeof window !== 'undefined' &&
           typeof window.cv !== 'undefined' &&
           window.cv !== null &&
           typeof window.cv.Mat === 'function';
  }

  /**
   * Load OpenCV.js with fallback URLs
   */
  async load(): Promise<OpenCVLoadResult> {
    if (this.isLoaded && this.isOpenCVAvailable()) {
      return { success: true };
    }

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this.loadOpenCV();

    try {
      const result = await this.loadPromise;
      this.isLoaded = result.success;
      return result;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Internal method to load OpenCV from multiple CDN sources
   */
  private async loadOpenCV(): Promise<OpenCVLoadResult> {
    const opencvUrls = [
      'https://cdn.jsdelivr.net/npm/opencv.js@1.2.1/opencv.js',
      'https://docs.opencv.org/4.7.0/opencv.js',
      'https://unpkg.com/opencv.js@1.2.1/opencv.js',
      'https://cdn.jsdelivr.net/npm/opencv.js@1.2.1/opencv.min.js',
    ];

    for (const url of opencvUrls) {
      try {
        console.log(`🔄 Loading OpenCV from: ${url}`);
        await this.loadScript(url);
        const initResult = await this.waitForOpenCVInitialization(20000); // 20 second timeout

        if (initResult.success) {
          console.log(`✅ OpenCV.js loaded successfully from: ${url}`);
          console.log(`📊 OpenCV version: ${this.getOpenCVVersion()}`);
          return initResult;
        }
      } catch (error) {
        console.warn(`❌ Failed to load OpenCV from ${url}:`, error);
      }
    }

    return {
      success: false,
      error: 'Failed to load OpenCV.js from any CDN source'
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
   * Wait for OpenCV to be fully initialized
   */
  private waitForOpenCVInitialization(timeoutMs: number): Promise<OpenCVLoadResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkOpenCV = () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('OpenCV initialization timeout'));
          return;
        }

        if (this.isOpenCVAvailable()) {
          try {
            // Test basic OpenCV functionality
            const testMat = new window.cv.Mat();
            testMat.delete(); // Clean up test matrix

            resolve({
              success: true,
              version: this.getOpenCVVersion()
            });
          } catch (error) {
            reject(error);
          }
        } else {
          setTimeout(checkOpenCV, 200); // Check every 200ms
        }
      };

      checkOpenCV();
    });
  }

  /**
   * Get OpenCV version information
   */
  private getOpenCVVersion(): string {
    try {
      if (window.cv && window.cv.getBuildInformation) {
        const buildInfo = window.cv.getBuildInformation();
        return buildInfo || 'Unknown';
      }
      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Test OpenCV functionality
   */
  async testOpenCV(): Promise<boolean> {
    if (!this.isOpenCVAvailable()) {
      return false;
    }

    try {
      // Test basic operations
      const mat = new window.cv.Mat(10, 10, window.cv.CV_8UC1);
      const result = mat.rows === 10 && mat.cols === 10;
      mat.delete();
      return result;
    } catch (error) {
      console.error('OpenCV test failed:', error);
      return false;
    }
  }

  /**
   * Clean up OpenCV resources (call when component unmounts)
   */
  cleanup(): void {
    this.isLoaded = false;
    this.isLoading = false;
    this.loadPromise = null;
  }
}

// Export singleton instance
export const opencvLoader = OpenCVLoader.getInstance();
