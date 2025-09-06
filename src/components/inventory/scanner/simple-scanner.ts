/**
 * Simple Document Scanner - Based on Scanbot Tutorial Approach
 * Provides a straightforward document scanning implementation using jscanify
 */

declare global {
  interface Window {
    jscanify: any;
    cv: any;
  }
}

export interface SimpleScanResult {
  success: boolean;
  image?: HTMLCanvasElement;
  corners?: any[];
  error?: string;
}

export class SimpleScanner {
  private scanner: any = null;

  /**
   * Initialize the scanner
   */
  async initialize(): Promise<boolean> {
    try {
      // Wait for both OpenCV and jscanify to be available
      if (!window.cv) {
        console.warn('OpenCV not available');
        return false;
      }

      if (!window.jscanify) {
        console.warn('jscanify not available');
        return false;
      }

      // Create scanner instance
      this.scanner = new window.jscanify();
      console.log('✅ Simple scanner initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize simple scanner:', error);
      return false;
    }
  }

  /**
   * Scan document from image element - follows Scanbot tutorial pattern
   */
  async scanFromImage(imageElement: HTMLImageElement): Promise<SimpleScanResult> {
    if (!this.scanner) {
      return { success: false, error: 'Scanner not initialized' };
    }

    try {
      console.log('📄 Scanning document from image...');

      // Extract paper using jscanify - based on tutorial approach
      const extractedCanvas = this.scanner.extractPaper(imageElement, 500, 700);

      if (!extractedCanvas) {
        return { success: false, error: 'No document detected in image' };
      }

      // Get corner points
      const mat = window.cv.imread(imageElement);
      const contour = this.scanner.findPaperContour(mat);
      const corners = this.scanner.getCornerPoints(contour);

      console.log('✅ Document scanned successfully');
      return {
        success: true,
        image: extractedCanvas,
        corners: corners
      };
    } catch (error) {
      console.error('Scan failed:', error);
      return { success: false, error: 'Scan failed: ' + error };
    }
  }

  /**
   * Highlight document in image - for preview
   */
  highlightDocument(imageElement: HTMLImageElement): HTMLCanvasElement | null {
    if (!this.scanner) {
      console.warn('Scanner not initialized');
      return null;
    }

    try {
      return this.scanner.highlightPaper(imageElement);
    } catch (error) {
      console.error('Highlight failed:', error);
      return null;
    }
  }

  /**
   * Check if scanner is ready
   */
  isReady(): boolean {
    return this.scanner !== null && window.cv && window.jscanify;
  }

  /**
   * Get scanner status
   */
  getStatus() {
    return {
      initialized: this.scanner !== null,
      opencvAvailable: !!window.cv,
      jscanifyAvailable: !!window.jscanify
    };
  }
}

// Export singleton instance
export const simpleScanner = new SimpleScanner();
