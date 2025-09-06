import { ScannerConfig, ImageProcessingResult } from './scanner-types';

/**
 * Image processing utilities for document scanning
 * Handles preprocessing, enhancement, and optimization of images before detection
 */
export class ImageProcessor {
  private config: ScannerConfig;

  constructor(config: ScannerConfig) {
    this.config = config;
  }

  /**
   * Process canvas image for optimal document detection
   */
  processCanvas(canvas: HTMLCanvasElement): ImageProcessingResult {
    try {
      const ctx = canvas.getContext('2d')!;
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Apply preprocessing steps
      imageData = this.applyPreprocessing(imageData);

      // Create new canvas with processed image
      const processedCanvas = document.createElement('canvas');
      const processedCtx = processedCanvas.getContext('2d')!;

      processedCanvas.width = imageData.width;
      processedCanvas.height = imageData.height;
      processedCtx.putImageData(imageData, 0, 0);

      return {
        canvas: processedCanvas,
        width: imageData.width,
        height: imageData.height,
        processed: true
      };
    } catch (error) {
      console.error('Image processing failed:', error);
      return {
        canvas,
        width: canvas.width,
        height: canvas.height,
        processed: false
      };
    }
  }

  /**
   * Apply comprehensive image preprocessing
   */
  private applyPreprocessing(imageData: ImageData): ImageData {
    let data = imageData.data;

    // Step 1: Noise reduction
    if (this.config.blurSize > 0) {
      data = this.applyGaussianBlur(data, imageData.width, imageData.height, this.config.blurSize);
    }

    // Step 2: Contrast enhancement
    if (this.config.enhanceContrast) {
      data = this.enhanceContrast(data);
    }

    // Step 3: Brightness normalization
    data = this.normalizeBrightness(data);

    // Step 4: Sharpening (subtle)
    data = this.applySharpening(data, imageData.width, imageData.height);

    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Apply Gaussian blur for noise reduction
   */
  private applyGaussianBlur(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    radius: number
  ): Uint8ClampedArray {
    const result = new Uint8ClampedArray(data.length);
    const sigma = radius / 3;
    const size = 2 * Math.ceil(3 * sigma) + 1;
    const kernel = this.generateGaussianKernel(size, sigma);

    // Apply blur to each channel separately
    for (let channel = 0; channel < 3; channel++) {
      const channelData = this.extractChannel(data, channel);
      const blurredChannel = this.convolve(channelData, width, height, kernel);
      this.insertChannel(result, blurredChannel, channel);
    }

    // Copy alpha channel unchanged
    for (let i = 3; i < data.length; i += 4) {
      result[i] = data[i];
    }

    return result;
  }

  /**
   * Generate Gaussian kernel
   */
  private generateGaussianKernel(size: number, sigma: number): number[] {
    const kernel: number[] = [];
    const center = Math.floor(size / 2);
    let sum = 0;

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const x = i - center;
        const y = j - center;
        const value = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
        kernel.push(value);
        sum += value;
      }
    }

    // Normalize
    for (let i = 0; i < kernel.length; i++) {
      kernel[i] /= sum;
    }

    return kernel;
  }

  /**
   * Convolve image with kernel
   */
  private convolve(
    data: number[],
    width: number,
    height: number,
    kernel: number[]
  ): number[] {
    const result: number[] = [];
    const kernelSize = Math.sqrt(kernel.length);
    const kernelRadius = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;

        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const px = x + kx - kernelRadius;
            const py = y + ky - kernelRadius;

            if (px >= 0 && px < width && py >= 0 && py < height) {
              const kernelIndex = ky * kernelSize + kx;
              const dataIndex = py * width + px;
              sum += data[dataIndex] * kernel[kernelIndex];
            }
          }
        }

        result.push(sum);
      }
    }

    return result;
  }

  /**
   * Enhance contrast using histogram equalization
   */
  private enhanceContrast(data: Uint8ClampedArray): Uint8ClampedArray {
    const result = new Uint8ClampedArray(data.length);

    // Calculate histogram
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      histogram[gray]++;
    }

    // Calculate cumulative distribution function
    const cdf = new Array(256).fill(0);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }

    // Find min and max values for contrast stretching
    const totalPixels = data.length / 4;
    const cdfMin = cdf.find(value => value > 0) || 0;
    const cdfMax = cdf[255];

    // Apply contrast enhancement
    for (let i = 0; i < data.length; i += 4) {
      for (let channel = 0; channel < 3; channel++) {
        const original = data[i + channel];
        const enhanced = Math.round(((cdf[original] - cdfMin) / (cdfMax - cdfMin)) * 255);
        result[i + channel] = Math.max(0, Math.min(255, enhanced));
      }
      result[i + 3] = data[i + 3]; // Keep alpha unchanged
    }

    return result;
  }

  /**
   * Normalize brightness to improve document detection
   */
  private normalizeBrightness(data: Uint8ClampedArray): Uint8ClampedArray {
    const result = new Uint8ClampedArray(data.length);

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
        result[i + channel] = Math.max(0, Math.min(255, adjusted));
      }
      result[i + 3] = data[i + 3];
    }

    return result;
  }

  /**
   * Apply subtle sharpening to enhance edges
   */
  private applySharpening(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): Uint8ClampedArray {
    const result = new Uint8ClampedArray(data.length);

    // Simple sharpening kernel
    const kernel = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ];

    const kernelSize = 3;
    const kernelRadius = 1;

    // Apply sharpening to each channel
    for (let channel = 0; channel < 3; channel++) {
      const channelData = this.extractChannel(data, channel);
      const sharpenedChannel = this.convolve(channelData, width, height, kernel);
      this.insertChannel(result, sharpenedChannel, channel);
    }

    // Copy alpha channel unchanged
    for (let i = 3; i < data.length; i += 4) {
      result[i] = data[i];
    }

    return result;
  }

  /**
   * Extract single color channel from RGBA data
   */
  private extractChannel(data: Uint8ClampedArray, channel: number): number[] {
    const result: number[] = [];
    for (let i = channel; i < data.length; i += 4) {
      result.push(data[i]);
    }
    return result;
  }

  /**
   * Insert single color channel into RGBA data
   */
  private insertChannel(data: Uint8ClampedArray, channelData: number[], channel: number): void {
    for (let i = 0; i < channelData.length; i++) {
      data[i * 4 + channel] = Math.max(0, Math.min(255, channelData[i]));
    }
  }

  /**
   * Resize image while maintaining aspect ratio
   */
  resizeImage(
    canvas: HTMLCanvasElement,
    maxWidth: number,
    maxHeight: number
  ): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;

    // Calculate new dimensions
    let newWidth = width;
    let newHeight = height;

    if (width > maxWidth) {
      newWidth = maxWidth;
      newHeight = (height * maxWidth) / width;
    }

    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = (width * maxHeight) / height;
    }

    // Create new canvas
    const resizedCanvas = document.createElement('canvas');
    const resizedCtx = resizedCanvas.getContext('2d')!;

    resizedCanvas.width = newWidth;
    resizedCanvas.height = newHeight;

    // Draw resized image
    resizedCtx.drawImage(canvas, 0, 0, newWidth, newHeight);

    return resizedCanvas;
  }

  /**
   * Convert image to grayscale
   */
  static toGrayscale(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      data[i] = gray;     // Red
      data[i + 1] = gray; // Green
      data[i + 2] = gray; // Blue
      // Alpha remains unchanged
    }

    const grayCanvas = document.createElement('canvas');
    const grayCtx = grayCanvas.getContext('2d')!;
    grayCanvas.width = canvas.width;
    grayCanvas.height = canvas.height;
    grayCtx.putImageData(imageData, 0, 0);

    return grayCanvas;
  }
}
