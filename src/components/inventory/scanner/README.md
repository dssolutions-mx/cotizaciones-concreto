# Scanner Module Documentation

This modular scanner system provides robust document detection and scanning capabilities using OpenCV and jscanify libraries. The architecture is designed to be maintainable, extensible, and highly configurable.

## Architecture Overview

The scanner module is organized into several key components:

```
scanner/
├── index.ts              # Main exports
├── README.md             # This documentation
├── scanner-types.ts      # TypeScript type definitions
├── scanner-config.ts     # Configuration management
├── scanner-manager.ts    # Main coordinator
├── opencv-loader.ts      # OpenCV.js loading utilities
├── jscanify-loader.ts    # jscanify loading utilities
├── canny-optimizer.ts    # Advanced Canny edge detection
├── document-detector.ts  # Document detection algorithms
└── image-processor.ts    # Image preprocessing utilities
```

## Key Improvements

### 1. **Enhanced Canny Algorithm**
- **Multiple Parameter Sets**: Tests various Canny threshold combinations for optimal document detection
- **Adaptive Parameters**: Automatically adjusts parameters based on image characteristics
- **Contour Scoring**: Advanced scoring system to select the best document candidate
- **Fallback Strategies**: Multiple detection strategies ensure reliability

### 2. **Robust Document Detection**
- **Hybrid Approach**: Combines jscanify and custom OpenCV implementations
- **Quality Assessment**: Evaluates detection confidence and validity
- **Contour Analysis**: Advanced contour analysis for better document identification

### 3. **Image Preprocessing**
- **Noise Reduction**: Gaussian blur for cleaner edge detection
- **Contrast Enhancement**: Histogram equalization for better document visibility
- **Brightness Normalization**: Consistent lighting for reliable detection
- **Sharpening**: Subtle edge enhancement for clearer contours

### 4. **Modular Design**
- **Separation of Concerns**: Each module has a single responsibility
- **Easy Configuration**: Centralized configuration management
- **Extensible Architecture**: Simple to add new detection methods
- **Error Handling**: Comprehensive error handling and fallback mechanisms

## Usage

### Basic Usage

```typescript
import { scannerManager } from './scanner';

// Initialize the scanner
const initResult = await scannerManager.initialize();
if (!initResult.success) {
  console.error('Scanner initialization failed:', initResult.error);
  return;
}

// Detect document in canvas
const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
const detectionResult = await scannerManager.detectDocument(canvas);

if (detectionResult.success) {
  console.log('Document detected with confidence:', detectionResult.confidence);

  // Extract the document
  const extractedCanvas = await scannerManager.extractDocument(canvas, detectionResult.corners!);

  // Or highlight the document
  scannerManager.highlightDocument(canvas, detectionResult.corners!, '#00ff00', 3);
} else {
  console.error('Document detection failed:', detectionResult.error);
}
```

### Advanced Configuration

```typescript
import { ScannerManager, getScannerConfig } from './scanner';

// Create scanner with custom configuration
const customConfig = getScannerConfig({
  cannyLowThreshold: 40,
  cannyHighThreshold: 120,
  enhanceContrast: true,
  minContourArea: 15000,
  qualityThreshold: 0.8
});

const scanner = new ScannerManager(customConfig);
await scanner.initialize();
```

### Configuration Presets

```typescript
import { scannerPresets } from './scanner';

// Use preset for receipts
const receiptScanner = new ScannerManager(scannerPresets.receipt);

// Use preset for invoices
const invoiceScanner = new ScannerManager(scannerPresets.invoice);
```

## Configuration Options

### ScannerConfig Interface

```typescript
interface ScannerConfig {
  // OpenCV and jscanify settings
  useExtractPaper: boolean;      // Whether to use jscanify's extractPaper
  qualityThreshold: number;      // Minimum quality for extractPaper
  maxExtractSize: number;        // Maximum size for extraction

  // Canny algorithm parameters
  cannyLowThreshold: number;     // Low threshold for Canny
  cannyHighThreshold: number;    // High threshold for Canny
  cannyApertureSize: number;     // Aperture size for Canny
  cannyL2Gradient: boolean;      // Use L2 gradient for Canny

  // Document detection settings
  minContourArea: number;        // Minimum contour area
  maxContourArea: number;        // Maximum contour area
  minAspectRatio: number;        // Minimum aspect ratio
  maxAspectRatio: number;        // Maximum aspect ratio
  minSolidity: number;           // Minimum solidity

  // Image preprocessing
  blurSize: number;              // Gaussian blur size
  autoCrop: boolean;             // Auto crop after extraction
  enhanceContrast: boolean;      // Enhance contrast
}
```

## Detection Methods

### 1. **jscanify Primary** (`useExtractPaper: true`)
- Uses jscanify's built-in document detection
- Fast and reliable for well-lit, high-contrast documents
- Falls back to OpenCV if jscanify fails

### 2. **Optimized Canny** (Fallback/Default)
- Advanced Canny edge detection with multiple parameter sets
- Contour analysis and scoring
- Best for difficult lighting conditions or complex backgrounds

### 3. **Hybrid Approach** (Automatic)
- Tries jscanify first
- Falls back to optimized Canny if confidence is low
- Uses basic contour detection as final fallback

## Performance Optimization

### Canny Parameter Optimization
The system automatically tests multiple Canny parameter combinations:
- Conservative settings for noisy images
- Aggressive settings for clean documents
- Adaptive parameters based on image analysis

### Image Preprocessing Pipeline
1. **Noise Reduction**: Gaussian blur to reduce noise
2. **Contrast Enhancement**: Histogram equalization
3. **Brightness Normalization**: Consistent lighting
4. **Edge Enhancement**: Subtle sharpening

## Error Handling

The scanner implements comprehensive error handling:

- **Loading Failures**: Fallback CDN URLs for libraries
- **Detection Failures**: Multiple detection strategies
- **Extraction Failures**: Basic extraction as fallback
- **Configuration Errors**: Validation and defaults

## Extending the Scanner

### Adding New Detection Methods

```typescript
// Create a new detector class
class CustomDetector {
  async detectDocument(canvas: HTMLCanvasElement): Promise<DocumentDetectionResult> {
    // Your custom detection logic
  }
}

// Add to DocumentDetector
export class AdvancedDocumentDetector extends DocumentDetector {
  private customDetector = new CustomDetector();

  async detectDocument(canvas: HTMLCanvasElement): Promise<DocumentDetectionResult> {
    // Try custom detection first
    const customResult = await this.customDetector.detectDocument(canvas);
    if (customResult.success && customResult.confidence! > 0.8) {
      return customResult;
    }

    // Fall back to existing methods
    return super.detectDocument(canvas);
  }
}
```

### Adding New Preprocessing Steps

```typescript
// Extend ImageProcessor
export class AdvancedImageProcessor extends ImageProcessor {
  applyAdvancedPreprocessing(imageData: ImageData): ImageData {
    // Your advanced preprocessing
    let data = imageData.data;

    // Add your custom preprocessing steps
    data = this.applyCustomFilter(data);
    data = this.applyAnotherEnhancement(data);

    return new ImageData(data, imageData.width, imageData.height);
  }
}
```

## Troubleshooting

### Common Issues

1. **"OpenCV loading failed"**
   - Check network connectivity
   - Verify CDN availability
   - Check browser console for detailed errors

2. **"Document detection unreliable"**
   - Adjust `qualityThreshold` in configuration
   - Try different `cannyLowThreshold` and `cannyHighThreshold` values
   - Enable `enhanceContrast` for low-contrast documents

3. **"Extraction quality poor"**
   - Increase `maxExtractSize` for higher resolution
   - Ensure document is well-lit and in focus
   - Try adjusting preprocessing parameters

### Debugging

Enable detailed logging by setting:
```typescript
localStorage.setItem('scanner_debug', 'true');
```

This will provide detailed console output for each detection step.

## Future Improvements

### Planned Enhancements

1. **Machine Learning Integration**: Use ML models for better document detection
2. **Multi-document Detection**: Detect multiple documents in one image
3. **Real-time Processing**: Optimize for video streams
4. **Cloud Processing**: Offload heavy processing to cloud services
5. **Document Classification**: Automatically classify document types

### Performance Optimizations

1. **WebAssembly**: Use WebAssembly versions of OpenCV
2. **Worker Threads**: Move processing to background threads
3. **GPU Acceleration**: Utilize WebGL for faster processing
4. **Streaming Processing**: Process images in chunks for large files

This modular architecture makes it easy to implement these improvements incrementally without affecting the existing functionality.
