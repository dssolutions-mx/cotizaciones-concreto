import {
  ScannerConfig,
  ImageProcessingResult,
  AdaptiveThresholds,
  EnhancedProcessingResult,
  DocumentQualityMetrics
} from './scanner-types';

/**
 * Advanced image processor with CLAHE, LAB color space, and adaptive thresholding
 * Implements sophisticated preprocessing for robust document edge detection
 */
export class AdvancedImageProcessor {
  private config: ScannerConfig;

  constructor(config: ScannerConfig) {
    this.config = config;
  }

  /**
   * Apply advanced preprocessing pipeline for optimal document detection
   */
  applyAdvancedPreprocessing(
    canvas: HTMLCanvasElement,
    enableDebugging: boolean = false
  ): EnhancedProcessingResult {
    const steps: string[] = [];
    let currentCanvas = canvas;
    let qualityScore = 0;

    try {
      // Step 1: Convert to LAB color space if enabled
      if (this.config.useLabColorSpace) {
        steps.push("Converting to LAB color space");
        currentCanvas = this.convertToLabColorSpace(currentCanvas);
        qualityScore += 0.1;
      }

      // Step 2: Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
      if (this.config.useClahe) {
        steps.push("Applying CLAHE for contrast enhancement");
        currentCanvas = this.applyClahe(currentCanvas);
        qualityScore += 0.2;
      }

      // Step 3: Noise reduction with adaptive blur
      if (this.config.blurSize > 0) {
        steps.push("Applying adaptive noise reduction");
        currentCanvas = this.applyAdaptiveBlur(currentCanvas);
        qualityScore += 0.1;
      }

      // Step 4: Adaptive thresholding
      if (this.config.useAdaptiveThresholding) {
        steps.push("Applying adaptive thresholding");
        currentCanvas = this.applyAdaptiveThresholding(currentCanvas);
        qualityScore += 0.2;
      }

      // Step 5: Morphological operations for cleanup
      if (this.config.useMorphologicalOperations) {
        steps.push("Applying morphological operations");
        currentCanvas = this.applyMorphologicalOperations(currentCanvas);
        qualityScore += 0.1;
      }

      // Step 6: Quality enhancement
      if (this.config.enableQualityEnhancement) {
        steps.push("Applying quality enhancement");
        currentCanvas = this.applyQualityEnhancement(currentCanvas);
        qualityScore += 0.2;
      }

      // Step 7: Brightness normalization
      steps.push("Normalizing brightness");
      currentCanvas = this.normalizeBrightness(currentCanvas);
      qualityScore += 0.1;

      // Calculate final quality score
      const finalQualityScore = Math.min(1.0, qualityScore);

      return {
        processedCanvas: currentCanvas,
        confidence: finalQualityScore,
        preprocessingSteps: steps,
        qualityScore: finalQualityScore
      };

    } catch (error) {
      console.error('Advanced preprocessing failed:', error);
      return {
        processedCanvas: canvas,
        confidence: 0,
        preprocessingSteps: steps,
        qualityScore: 0
      };
    }
  }

  /**
   * Convert image to LAB color space for better contrast handling
   */
  private convertToLabColorSpace(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert RGB to LAB color space
    const labData = new Uint8ClampedArray(data.length);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      // RGB to XYZ conversion
      let x = r * 0.4124 + g * 0.3576 + b * 0.1805;
      const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
      let z = r * 0.0193 + g * 0.1192 + b * 0.9505;

      // XYZ to LAB conversion (normalized)
      x = x / 0.95047;
      z = z / 1.08883;

      const fx = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
      const fy = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
      const fz = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);

      const L = 116 * fy - 16;
      const A = 500 * (fx - fy);
      const B = 200 * (fy - fz);

      // Store LAB values (normalized to 0-255)
      labData[i] = Math.max(0, Math.min(255, (L / 100) * 255));     // L channel
      labData[i + 1] = Math.max(0, Math.min(255, (A + 128)));       // A channel
      labData[i + 2] = Math.max(0, Math.min(255, (B + 128)));       // B channel
      labData[i + 3] = data[i + 3];                                 // Alpha
    }

    const labCanvas = document.createElement('canvas');
    const labCtx = labCanvas.getContext('2d')!;
    labCanvas.width = canvas.width;
    labCanvas.height = canvas.height;

    const labImageData = new ImageData(labData, canvas.width, canvas.height);
    labCtx.putImageData(labImageData, 0, 0);

    return labCanvas;
  }

  /**
   * Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
   */
  private applyClahe(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Create OpenCV matrix from image data
    const src = window.cv.matFromImageData(imageData);
    const gray = new window.cv.Mat();
    const claheResult = new window.cv.Mat();

    // Convert to grayscale for CLAHE
    window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

    // Apply CLAHE
    const clahe = new window.cv.CLAHE(
      this.config.claheClipLimit,
      new window.cv.Size(this.config.claheTileGridSize, this.config.claheTileGridSize)
    );
    clahe.apply(gray, claheResult);

    // Convert back to RGBA
    const result = new window.cv.Mat();
    window.cv.cvtColor(claheResult, result, window.cv.COLOR_GRAY2RGBA);

    // Create result canvas
    const resultCanvas = document.createElement('canvas');
    window.cv.imshow(resultCanvas, result);

    // Clean up OpenCV matrices
    src.delete();
    gray.delete();
    claheResult.delete();
    result.delete();
    clahe.delete();

    return resultCanvas;
  }

  /**
   * Apply adaptive blur based on image content
   */
  private applyAdaptiveBlur(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const src = window.cv.matFromImageData(imageData);
    const blurred = new window.cv.Mat();

    // Apply Gaussian blur with adaptive kernel size
    const kernelSize = Math.max(3, Math.min(7, Math.floor(this.config.blurSize)));
    window.cv.GaussianBlur(
      src,
      blurred,
      new window.cv.Size(kernelSize, kernelSize),
      this.config.blurSize / 3
    );

    // Create result canvas
    const resultCanvas = document.createElement('canvas');
    window.cv.imshow(resultCanvas, blurred);

    // Clean up
    src.delete();
    blurred.delete();

    return resultCanvas;
  }

  /**
   * Apply adaptive thresholding
   */
  private applyAdaptiveThresholding(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const src = window.cv.matFromImageData(imageData);
    const gray = new window.cv.Mat();
    const thresholded = new window.cv.Mat();

    // Convert to grayscale
    window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

    // Apply adaptive thresholding
    window.cv.adaptiveThreshold(
      gray,
      thresholded,
      255,
      window.cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      window.cv.THRESH_BINARY,
      this.config.adaptiveThresholdBlockSize,
      this.config.adaptiveThresholdC
    );

    // Convert back to RGBA
    const result = new window.cv.Mat();
    window.cv.cvtColor(thresholded, result, window.cv.COLOR_GRAY2RGBA);

    // Create result canvas
    const resultCanvas = document.createElement('canvas');
    window.cv.imshow(resultCanvas, result);

    // Clean up
    src.delete();
    gray.delete();
    thresholded.delete();
    result.delete();

    return resultCanvas;
  }

  /**
   * Apply morphological operations for cleanup
   */
  private applyMorphologicalOperations(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const src = window.cv.matFromImageData(imageData);
    const gray = new window.cv.Mat();
    const morphed = new window.cv.Mat();

    // Convert to grayscale
    window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

    // Create morphological kernel
    const kernel = window.cv.getStructuringElement(
      window.cv.MORPH_RECT,
      new window.cv.Size(this.config.morphologicalKernelSize, this.config.morphologicalKernelSize)
    );

    // Apply morphological closing to fill gaps
    window.cv.morphologyEx(gray, morphed, window.cv.MORPH_CLOSE, kernel);

    // Apply morphological opening to remove noise
    const opened = new window.cv.Mat();
    window.cv.morphologyEx(morphed, opened, window.cv.MORPH_OPEN, kernel);

    // Convert back to RGBA
    const result = new window.cv.Mat();
    window.cv.cvtColor(opened, result, window.cv.COLOR_GRAY2RGBA);

    // Create result canvas
    const resultCanvas = document.createElement('canvas');
    window.cv.imshow(resultCanvas, result);

    // Clean up
    src.delete();
    gray.delete();
    morphed.delete();
    opened.delete();
    result.delete();
    kernel.delete();

    return resultCanvas;
  }

  /**
   * Apply quality enhancement with additional CLAHE
   */
  private applyQualityEnhancement(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const src = window.cv.matFromImageData(imageData);
    const gray = new window.cv.Mat();
    const enhanced = new window.cv.Mat();

    // Convert to grayscale
    window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

    // Apply CLAHE for quality enhancement
    const clahe = new window.cv.CLAHE(
      this.config.qualityEnhancementClipLimit,
      new window.cv.Size(8, 8)
    );
    clahe.apply(gray, enhanced);

    // Convert back to RGBA
    const result = new window.cv.Mat();
    window.cv.cvtColor(enhanced, result, window.cv.COLOR_GRAY2RGBA);

    // Create result canvas
    const resultCanvas = document.createElement('canvas');
    window.cv.imshow(resultCanvas, result);

    // Clean up
    src.delete();
    gray.delete();
    enhanced.delete();
    result.delete();
    clahe.delete();

    return resultCanvas;
  }

  /**
   * Normalize brightness for consistent processing
   */
  private normalizeBrightness(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Calculate average brightness
    let totalBrightness = 0;
    let pixelCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      totalBrightness += brightness;
      pixelCount++;
    }

    const avgBrightness = totalBrightness / pixelCount;
    const targetBrightness = 128;
    const adjustment = targetBrightness - avgBrightness;

    // Apply brightness adjustment
    for (let i = 0; i < data.length; i += 4) {
      for (let channel = 0; channel < 3; channel++) {
        const adjusted = data[i + channel] + adjustment;
        data[i + channel] = Math.max(0, Math.min(255, adjusted));
      }
    }

    const resultCanvas = document.createElement('canvas');
    const resultCtx = resultCanvas.getContext('2d')!;
    resultCanvas.width = canvas.width;
    resultCanvas.height = canvas.height;
    resultCtx.putImageData(imageData, 0, 0);

    return resultCanvas;
  }

  /**
   * Calculate adaptive Canny thresholds using Otsu method
   */
  calculateAdaptiveThresholds(canvas: HTMLCanvasElement): AdaptiveThresholds {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Calculate histogram
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const gray = Math.round(0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2]);
      histogram[gray]++;
    }

    // Calculate Otsu threshold
    const threshold = this.calculateOtsuThreshold(histogram, imageData.data.length / 4);

    // Adaptive threshold calculation
    const lowerThresh = Math.max(10, threshold * 0.5);
    const upperThresh = Math.min(255, threshold * 1.5);

    return { lower: lowerThresh, upper: upperThresh };
  }

  /**
   * Calculate Otsu threshold
   */
  private calculateOtsuThreshold(histogram: number[], totalPixels: number): number {
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let mB;
    let mF;
    let max = 0;
    let threshold = 0;
    let between = 0;
    let variance;

    for (let i = 0; i < 256; i++) {
      wB += histogram[i];
      if (wB === 0) continue;
      wF = totalPixels - wB;
      if (wF === 0) break;

      sumB += i * histogram[i];
      mB = sumB / wB;
      mF = (sum - sumB) / wF;
      between = wB * wF * (mB - mF) * (mB - mF);
      if (between > max) {
        max = between;
        threshold = i;
      }
    }

    return threshold;
  }

  /**
   * Analyze document quality metrics
   */
  analyzeDocumentQuality(canvas: HTMLCanvasElement): DocumentQualityMetrics {
    // Validate canvas dimensions before analysis
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      console.warn('⚠️ Invalid canvas dimensions for quality analysis:', {
        width: canvas?.width,
        height: canvas?.height
      });
      return {
        brightness: 0.5,
        contrast: 0.5,
        sharpness: 0.5,
        overallQuality: 0.5
      };
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('⚠️ Could not get canvas context for quality analysis');
      return {
        brightness: 0.5,
        contrast: 0.5,
        sharpness: 0.5,
        overallQuality: 0.5
      };
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Calculate brightness
    let totalBrightness = 0;
    const totalContrast = 0;
    const totalSharpness = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += brightness;
    }

    const avgBrightness = totalBrightness / pixelCount;

    // Calculate contrast (standard deviation of brightness)
    let brightnessVariance = 0;
    for (let i = 0; i < data.length; i += 4) {
      const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      brightnessVariance += Math.pow(brightness - avgBrightness, 2);
    }
    const contrast = Math.sqrt(brightnessVariance / pixelCount);

    // Calculate sharpness (edge density)
    let edgeCount = 0;
    const kernel = [
      -1, -1, -1,
      -1,  8, -1,
      -1, -1, -1
    ];

    for (let y = 1; y < canvas.height - 1; y++) {
      for (let x = 1; x < canvas.width - 1; x++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * canvas.width + (x + kx)) * 4;
            const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            sum += gray * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        if (Math.abs(sum) > 50) edgeCount++;
      }
    }

    const sharpness = edgeCount / (canvas.width * canvas.height);

    // Calculate overall quality score
    const brightnessScore = Math.max(0, 1 - Math.abs(avgBrightness - 128) / 128);
    const contrastScore = Math.min(1, contrast / 50);
    const sharpnessScore = Math.min(1, sharpness * 10);
    const overallQuality = (brightnessScore * 0.3 + contrastScore * 0.4 + sharpnessScore * 0.3);

    return {
      brightness: avgBrightness / 255,
      contrast: contrast / 255,
      sharpness,
      overallQuality
    };
  }
}
