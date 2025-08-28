import { Point, DocumentDetectionResult } from './scanner-types';

/**
 * Simple Document Scanner - The way it should be!
 * Use OpenCV → Canny → Find biggest rectangle → Done!
 */
export class SimpleDocumentScanner {
  private canvasWidth: number = 0;
  private canvasHeight: number = 0;

  /**
   * Simple document detection using the most straightforward approach
   */
  async detectDocument(canvas: HTMLCanvasElement): Promise<DocumentDetectionResult> {
    console.log('🔍 Simple Document Scanner - Starting...');
    console.log(`📐 Working with canvas: ${canvas.width}x${canvas.height}`);

    // Store canvas dimensions for use in other methods
    this.canvasWidth = canvas.width;
    this.canvasHeight = canvas.height;

    try {
      // Step 1: Get canvas context with performance optimization
      const ctx = canvas.getContext('2d', {
        willReadFrequently: true,
        alpha: false
      })!;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      console.log(`📊 ImageData dimensions: ${imageData.width}x${imageData.height}`);

      // Step 2: Convert to OpenCV format
      const src = window.cv.matFromImageData(imageData);
      const gray = new window.cv.Mat();

      // Step 3: Convert to grayscale
      window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

      // Step 4: Apply Gaussian blur to reduce noise
      const blurred = new window.cv.Mat();
      window.cv.GaussianBlur(gray, blurred, new window.cv.Size(5, 5), 0);

      // Step 5: Apply Canny edge detection - THE KEY STEP!
      const edges = new window.cv.Mat();
      window.cv.Canny(blurred, edges, 50, 150, 3, false);

      // Step 6: Dilate edges to connect broken lines
      const dilated = new window.cv.Mat();
      const kernel = window.cv.getStructuringElement(window.cv.MORPH_RECT, new window.cv.Size(3, 3));
      window.cv.dilate(edges, dilated, kernel);

      // Step 7: Find contours
      const contours = new window.cv.MatVector();
      const hierarchy = new window.cv.Mat();

      // Ensure we're working with the correct image dimensions
      console.log(`🔍 Finding contours on image: ${dilated.cols}x${dilated.rows}`);
      window.cv.findContours(dilated, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);
      console.log(`📊 Found ${contours.size()} contours on ${dilated.cols}x${dilated.rows} image`);

      // Step 8: Find the biggest rectangle that looks like a document
      const documentContour = this.findBestDocumentContour(contours, canvas.width, canvas.height);

      // Step 9: Clean up
      src.delete();
      gray.delete();
      blurred.delete();
      edges.delete();
      dilated.delete();
      kernel.delete();
      contours.delete();
      hierarchy.delete();

      if (documentContour) {
        console.log('✅ Simple scanner found document!');
        return {
          success: true,
          corners: documentContour.corners,
          confidence: documentContour.confidence,
          method: 'simple_canny',
          contourInfo: documentContour
        };
      } else {
        console.log('⚠️ Simple scanner found no valid document');
        return {
          success: false,
          error: 'No document found'
        };
      }

    } catch (error) {
      console.error('❌ Simple scanner failed:', error);
      return {
        success: false,
        error: `Simple scanner failed: ${error}`
      };
    }
  }

  /**
   * Find the contour that best represents a document
   */
  private findBestDocumentContour(contours: any, imageWidth: number, imageHeight: number): any | null {
    let bestContour = null;
    let bestScore = 0;
    const imageArea = imageWidth * imageHeight;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = window.cv.contourArea(contour);

      // Skip if too small or too big - be more inclusive for document detection
      if (area < imageArea * 0.01 || area > imageArea * 0.99) {
        continue;
      }

      // Approximate the contour to get polygon - be more lenient
      const approx = new window.cv.Mat();
      const perimeter = window.cv.arcLength(contour, true);
      // Use higher epsilon (0.05 instead of 0.02) for more lenient approximation
      window.cv.approxPolyDP(contour, approx, 0.05 * perimeter, true);

      // Check if it's a polygon that could be a document
      if (approx.rows >= 4 && approx.rows <= 12) { // Allow 4-12 sided polygons
        // Calculate how rectangular it is
        const score = this.calculateRectangleScore(approx, imageWidth, imageHeight);

        // Debug: log some polygon info
        if (i < 5) { // Log first 5 polygons
          console.log(`🔍 Polygon ${i}: ${approx.rows} sides, score: ${score.toFixed(3)}, area: ${area.toFixed(0)}`);
        }

        // Be less strict with the scoring - accept any polygon with reasonable score
        if (score > bestScore && score > 0.05) { // Accept scores > 0.05
          bestScore = score;
          bestContour = {
            contour: approx,
            corners: this.extractCorners(approx),
            confidence: score,
            area: area
          };
        }
      }

      approx.delete();
    }

    console.log(`🏆 Best contour score: ${bestScore.toFixed(3)}`);

    // Fallback: if no good polygons found, use the largest contour as a fallback
    if (!bestContour) {
      console.log('⚠️ No good polygons found, using largest contour as fallback...');
      let largestContour = null;
      let largestArea = 0;

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = window.cv.contourArea(contour);

        if (area > largestArea && area > imageArea * 0.01) {
          largestArea = area;
          largestContour = contour;
        }
      }

      if (largestContour) {
        // Convert to approximate rectangle for largest contour
        const approx = new window.cv.Mat();
        const perimeter = window.cv.arcLength(largestContour, true);
        window.cv.approxPolyDP(largestContour, approx, 0.05 * perimeter, true);

        bestContour = {
          contour: approx,
          corners: this.extractCorners(approx),
          confidence: 0.3, // Lower confidence for fallback
          area: largestArea
        };

        console.log(`📄 Using largest contour as fallback with area: ${largestArea.toFixed(0)}`);
      }
    }

    return bestContour;
  }

  /**
   * Calculate a score for how suitable a contour is for document detection
   * Simpler and more forgiving scoring for real-world documents
   */
  private calculateRectangleScore(contour: any, imageWidth: number, imageHeight: number): number {
    const numPoints = contour.rows;

    // Base score from number of sides (4 is perfect, but allow some variation)
    let baseScore = 1.0;
    if (numPoints === 4) {
      baseScore = 1.0; // Perfect quadrilateral
    } else if (numPoints >= 4 && numPoints <= 6) {
      baseScore = 0.8; // Acceptable polygon
    } else if (numPoints >= 7 && numPoints <= 10) {
      baseScore = 0.6; // Could still be a document
    } else {
      baseScore = 0.3; // Many sides, less likely to be a document
    }

    // Size bonus - prefer contours that are reasonably large
    const contourArea = window.cv.contourArea(contour);
    const imageArea = imageWidth * imageHeight;
    const sizeRatio = contourArea / imageArea;

    let sizeScore = 0;
    if (sizeRatio > 0.05 && sizeRatio < 0.95) {
      sizeScore = 0.3; // Good size for document
    } else if (sizeRatio > 0.02 && sizeRatio < 0.98) {
      sizeScore = 0.2; // Acceptable size
    }

    // Perimeter bonus - prefer contours with reasonable perimeter
    const perimeter = window.cv.arcLength(contour, true);
    const imagePerimeter = (imageWidth + imageHeight) * 2;
    const perimeterRatio = perimeter / imagePerimeter;

    let perimeterScore = 0;
    if (perimeterRatio > 0.1 && perimeterRatio < 0.9) {
      perimeterScore = 0.2; // Good perimeter for document
    }

    // Return combined score (0-1 range)
    return Math.min(1.0, baseScore + sizeScore + perimeterScore);
  }

  /**
   * Extract corner points from contour - handles various polygon shapes
   */
  private extractCorners(contour: any): Point[] {
    const corners: Point[] = [];
    console.log(`🔍 Extracting corners from contour with ${contour.rows} points`);

    // Extract all points from the contour
    for (let i = 0; i < contour.rows; i++) {
      const x = contour.data32S[i * 2];
      const y = contour.data32S[i * 2 + 1];
      console.log(`  📍 Raw contour point ${i}: (${x}, ${y})`);

      corners.push({ x, y });
    }

    // Validate and bound coordinates to canvas dimensions
    const boundedCorners = corners.map((corner, index) => {
      // Skip invalid coordinates
      if (typeof corner.x !== 'number' || typeof corner.y !== 'number' ||
          !isFinite(corner.x) || !isFinite(corner.y)) {
        console.warn(`Invalid corner ${index}:`, corner);
        return null;
      }

      // Check for extreme values that indicate coordinate system issues
      if (Math.abs(corner.x) > 50000 || Math.abs(corner.y) > 50000) {
        console.warn(`Extreme corner ${index} detected:`, corner);
        return null;
      }

      const bounded = {
        x: Math.max(0, Math.min(this.canvasWidth, corner.x)),
        y: Math.max(0, Math.min(this.canvasHeight, corner.y))
      };

      // Log if coordinates were out of bounds
      if (corner.x !== bounded.x || corner.y !== bounded.y) {
        console.log(`🔧 Corner ${index} bounded: ${corner.x},${corner.y} → ${bounded.x},${bounded.y}`);
      }

      return bounded;
    }).filter(corner => corner !== null) as Point[];

    console.log(`📍 Extracted ${boundedCorners.length} corners:`,
      boundedCorners.map(c => `(${c.x.toFixed(1)},${c.y.toFixed(1)})`).join(', '));

    // If we have more than 4 points, try to simplify to 4 corners
    if (boundedCorners.length > 4) {
      return this.simplifyToFourCorners(boundedCorners);
    }

    // If we have fewer than 4 points, pad with duplicates (shouldn't happen but safety check)
    while (boundedCorners.length < 4 && boundedCorners.length > 0) {
      boundedCorners.push(boundedCorners[boundedCorners.length - 1]);
    }

    return boundedCorners.slice(0, 4); // Ensure exactly 4 corners
  }

  /**
   * Simplify a polygon with more than 4 points to exactly 4 corners
   */
  private simplifyToFourCorners(points: Point[]): Point[] {
    if (points.length <= 4) return points;

    // Simple approach: take the 4 points that are farthest apart
    // Start with the first point
    const result = [points[0]];

    // Find the point farthest from the first
    let farthest = 1;
    let maxDistance = 0;
    for (let i = 1; i < points.length; i++) {
      const distance = this.distance(points[0], points[i]);
      if (distance > maxDistance) {
        maxDistance = distance;
        farthest = i;
      }
    }
    result.push(points[farthest]);

    // Find the point farthest from both existing points
    maxDistance = 0;
    let nextFarthest = 0;
    for (let i = 0; i < points.length; i++) {
      if (i === 0 || i === farthest) continue;
      const dist1 = this.distance(points[i], points[0]);
      const dist2 = this.distance(points[i], points[farthest]);
      const minDist = Math.min(dist1, dist2);
      if (minDist > maxDistance) {
        maxDistance = minDist;
        nextFarthest = i;
      }
    }
    result.push(points[nextFarthest]);

    // Find the last point as the one farthest from the triangle
    maxDistance = 0;
    let lastFarthest = 0;
    for (let i = 0; i < points.length; i++) {
      if (i === 0 || i === farthest || i === nextFarthest) continue;
      const dist1 = this.distance(points[i], points[0]);
      const dist2 = this.distance(points[i], points[farthest]);
      const dist3 = this.distance(points[i], points[nextFarthest]);
      const minDist = Math.min(dist1, dist2, dist3);
      if (minDist > maxDistance) {
        maxDistance = minDist;
        lastFarthest = i;
      }
    }
    result.push(points[lastFarthest]);

    return result;
  }

  /**
   * Calculate distance between two points
   */
  private distance(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
