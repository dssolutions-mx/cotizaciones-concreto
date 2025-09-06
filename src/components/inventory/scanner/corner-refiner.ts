import {
  ScannerConfig,
  CornerRefinementResult,
  ContourInfo,
  Point
} from './scanner-types';

/**
 * Robust corner detection and refinement using Harris corner detector
 * Provides precise corner localization for document boundary detection
 */
export class CornerRefiner {
  private config: ScannerConfig;

  constructor(config: ScannerConfig) {
    this.config = config;
  }

  /**
   * Refine corners using Harris corner detection
   */
  async refineCorners(
    corners: Point[],
    canvas: HTMLCanvasElement,
    enableDebugging: boolean = false
  ): Promise<CornerRefinementResult> {
    if (corners.length < 4) {
      console.warn('CornerRefiner: Expected at least 4 corners, got', corners.length);
      return {
        refinedCorners: corners,
        confidence: 0.3,
        method: 'insufficient_corners'
      };
    }

    // If we have more than 4 corners, select the best 4
    let cornersToRefine = corners;
    if (corners.length > 4) {
      console.log(`🎯 Selecting best 4 corners from ${corners.length} available`);
      cornersToRefine = this.selectBestFourCorners(corners, canvas);
    }

    console.log('🎯 Starting corner refinement with Harris detector...');

    try {
      const refinedCorners = await this.applyHarrisRefinement(corners, canvas);
      const confidence = this.calculateRefinementConfidence(corners, refinedCorners, canvas);

      console.log(`✅ Corner refinement completed with confidence ${confidence.toFixed(3)}`);

      return {
        refinedCorners,
        confidence,
        method: 'harris'
      };
    } catch (error) {
      console.warn('Harris refinement failed, using original corners:', error);
      return {
        refinedCorners: corners,
        confidence: 0.6,
        method: 'contour_approx'
      };
    }
  }

  /**
   * Apply Harris corner detection for corner refinement
   */
  private async applyHarrisRefinement(corners: Point[], canvas: HTMLCanvasElement): Promise<Point[]> {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject) => {
      try {
        // Create OpenCV matrix
        const src = window.cv.matFromImageData(imageData);
        const gray = new window.cv.Mat();
        const harrisResponse = new window.cv.Mat();
        const harrisResponseNorm = new window.cv.Mat();
        const harrisResponseNormScaled = new window.cv.Mat();

        // Convert to grayscale
        window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

        // Apply Harris corner detection
        window.cv.cornerHarris(
          gray,
          harrisResponse,
          this.config.harrisBlockSize,
          this.config.harrisKSize,
          this.config.harrisK
        );

        // Normalize the response
        window.cv.normalize(harrisResponse, harrisResponseNorm, 0, 255, window.cv.NORM_MINMAX, window.cv.CV_32FC1);
        harrisResponseNorm.convertTo(harrisResponseNormScaled, window.cv.CV_8UC1);

        // Refine each corner
        const refinedCorners = corners.map(corner =>
          this.refineSingleCorner(corner, harrisResponseNormScaled, canvas)
        );

        // Clean up
        src.delete();
        gray.delete();
        harrisResponse.delete();
        harrisResponseNorm.delete();
        harrisResponseNormScaled.delete();

        resolve(refinedCorners);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Refine a single corner using Harris response in local window
   */
  private refineSingleCorner(
    corner: Point,
    harrisResponse: any,
    canvas: HTMLCanvasElement
  ): Point {
    const windowSize = this.config.cornerRefinementWindowSize;

    // Define search window around corner
    const halfWindow = Math.floor(windowSize / 2);
    const startX = Math.max(0, Math.floor(corner.x) - halfWindow);
    const startY = Math.max(0, Math.floor(corner.y) - halfWindow);
    const endX = Math.min(canvas.width, startX + windowSize);
    const endY = Math.min(canvas.height, startY + windowSize);

    let maxResponse = -1;
    let bestPoint = corner;

    // Search for maximum Harris response in window
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const response = harrisResponse.ucharPtr(y, x)[0];

        if (response > maxResponse) {
          maxResponse = response;
          bestPoint = { x, y };
        }
      }
    }

    return bestPoint;
  }

  /**
   * Sort corners in clockwise order starting from top-left
   */
  sortCornersClockwise(corners: Point[]): Point[] {
    if (corners.length !== 4) return corners;

    // Find center point
    const center = corners.reduce(
      (acc, corner) => ({
        x: acc.x + corner.x / 4,
        y: acc.y + corner.y / 4
      }),
      { x: 0, y: 0 }
    );

    // Sort by angle from center
    return corners.sort((a, b) => {
      const angleA = Math.atan2(a.y - center.y, a.x - center.x);
      const angleB = Math.atan2(b.y - center.y, b.x - center.x);
      return angleA - angleB;
    });
  }

  /**
   * Ensure corners form a valid quadrilateral
   */
  validateQuadrilateral(corners: Point[]): boolean {
    if (corners.length !== 4) return false;

    // Check that corners are reasonably spread out
    const area = this.calculateQuadrilateralArea(corners);
    const minAreaThreshold = 1000; // Minimum area threshold

    if (area < minAreaThreshold) return false;

    // Check that corners are not too close to each other
    const minDistanceThreshold = 50; // Minimum distance between corners

    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const distance = this.calculateDistance(corners[i], corners[j]);
        if (distance < minDistanceThreshold) return false;
      }
    }

    return true;
  }

  /**
   * Calculate area of quadrilateral using shoelace formula
   */
  private calculateQuadrilateralArea(corners: Point[]): number {
    if (corners.length !== 4) return 0;

    let area = 0;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      area += corners[i].x * corners[j].y;
      area -= corners[j].x * corners[i].y;
    }

    return Math.abs(area) / 2;
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(p1: Point, p2: Point): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  /**
   * Calculate confidence score for corner refinement
   */
  private calculateRefinementConfidence(
    originalCorners: Point[],
    refinedCorners: Point[],
    canvas: HTMLCanvasElement
  ): number {
    if (originalCorners.length !== 4 || refinedCorners.length !== 4) {
      return 0;
    }

    // Calculate average movement distance
    let totalMovement = 0;
    for (let i = 0; i < 4; i++) {
      const movement = this.calculateDistance(originalCorners[i], refinedCorners[i]);
      totalMovement += movement;
    }
    const avgMovement = totalMovement / 4;

    // Calculate quadrilateral regularity
    const area = this.calculateQuadrilateralArea(refinedCorners);
    const canvasArea = canvas.width * canvas.height;
    const areaRatio = area / canvasArea;

    // Calculate corner spread (how well distributed corners are)
    const spreadScore = this.calculateCornerSpread(refinedCorners, canvas);

    // Combine factors
    const movementScore = Math.max(0, 1 - avgMovement / 20); // Prefer small movements
    const areaScore = Math.min(1, areaRatio * 5); // Prefer reasonable coverage
    const spreadBonus = spreadScore * 0.3;

    const confidence = (movementScore * 0.4 + areaScore * 0.4 + spreadBonus * 0.2);

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate how well corners are spread across the canvas
   */
  private calculateCornerSpread(corners: Point[], canvas: HTMLCanvasElement): number {
    if (corners.length !== 4) return 0;

    // Calculate distances from canvas center
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    let totalDistanceFromCenter = 0;
    for (const corner of corners) {
      const distance = Math.sqrt(
        Math.pow(corner.x - centerX, 2) + Math.pow(corner.y - centerY, 2)
      );
      totalDistanceFromCenter += distance;
    }

    const avgDistance = totalDistanceFromCenter / 4;
    const maxPossibleDistance = Math.sqrt(centerX * centerX + centerY * centerY);

    return Math.min(avgDistance / maxPossibleDistance, 1.0);
  }

  /**
   * Select the best 4 corners from a set of corners
   * Chooses corners that form the most rectangular shape (typical for documents)
   */
  private selectBestFourCorners(corners: Point[], canvas: HTMLCanvasElement): Point[] {
    if (corners.length <= 4) {
      return corners;
    }

    let bestCorners = corners.slice(0, 4);
    let bestScore = this.calculateQuadrilateralScore(bestCorners);

    // Try different combinations of 4 corners
    for (let i = 0; i < corners.length - 3; i++) {
      for (let j = i + 1; j < corners.length - 2; j++) {
        for (let k = j + 1; k < corners.length - 1; k++) {
          for (let l = k + 1; l < corners.length; l++) {
            const candidateCorners = [corners[i], corners[j], corners[k], corners[l]];
            const score = this.calculateQuadrilateralScore(candidateCorners);

            if (score > bestScore) {
              bestScore = score;
              bestCorners = candidateCorners;
            }
          }
        }
      }
    }

    console.log(`🏆 Selected corners with score ${bestScore.toFixed(3)}`);
    return bestCorners;
  }

  /**
   * Calculate a score for how rectangular a quadrilateral is
   * Higher scores indicate more rectangular shapes
   */
  private calculateQuadrilateralScore(corners: Point[]): number {
    if (corners.length !== 4) return 0;

    // Calculate vectors between corners
    const vectors = [];
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      vectors.push({
        x: corners[next].x - corners[i].x,
        y: corners[next].y - corners[i].y
      });
    }

    // Calculate angles between adjacent vectors
    let angleScore = 0;
    for (let i = 0; i < 4; i++) {
      const v1 = vectors[i];
      const v2 = vectors[(i + 1) % 4];

      // Calculate dot product
      const dot = v1.x * v2.x + v1.y * v2.y;
      // Calculate magnitudes
      const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
      const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

      if (mag1 === 0 || mag2 === 0) continue;

      // Calculate cosine of angle
      const cosAngle = dot / (mag1 * mag2);
      // Convert to angle in degrees
      const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI;

      // Score based on how close to 90 degrees (right angle)
      const angleDiff = Math.abs(angle - 90);
      angleScore += Math.max(0, 90 - angleDiff);
    }

    // Normalize score (max possible is 360 for perfect rectangle)
    return angleScore / 360;
  }

  /**
   * Apply geometric constraints to ensure corners form a valid document
   */
  applyGeometricConstraints(corners: Point[], canvas: HTMLCanvasElement): Point[] {
    if (corners.length !== 4) return corners;

    // Sort corners in clockwise order
    const sortedCorners = this.sortCornersClockwise(corners);

    // Apply perspective correction constraints
    const constrainedCorners = this.applyPerspectiveConstraints(sortedCorners, canvas);

    // Ensure minimum distances between corners
    return this.enforceMinimumDistances(constrainedCorners, canvas);
  }

  /**
   * Apply perspective constraints to corners
   */
  private applyPerspectiveConstraints(corners: Point[], canvas: HTMLCanvasElement): Point[] {
    // Ensure corners are within canvas bounds with margin
    const margin = 10;
    return corners.map(corner => ({
      x: Math.max(margin, Math.min(canvas.width - margin, corner.x)),
      y: Math.max(margin, Math.min(canvas.height - margin, corner.y))
    }));
  }

  /**
   * Enforce minimum distances between corners
   */
  private enforceMinimumDistances(corners: Point[], canvas: HTMLCanvasElement): Point[] {
    const minDistance = Math.min(canvas.width, canvas.height) * 0.1; // 10% of smaller dimension

    // For each corner, ensure it's not too close to others
    const result = [...corners];

    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const distance = this.calculateDistance(result[i], result[j]);

        if (distance < minDistance) {
          // Move corners apart
          const angle = Math.atan2(result[j].y - result[i].y, result[j].x - result[i].x);
          const moveDistance = (minDistance - distance) / 2;

          result[i].x -= Math.cos(angle) * moveDistance;
          result[i].y -= Math.sin(angle) * moveDistance;
          result[j].x += Math.cos(angle) * moveDistance;
          result[j].y += Math.sin(angle) * moveDistance;
        }
      }
    }

    return result;
  }

  /**
   * Extract corners from contour information
   */
  extractCornersFromContour(contourInfo: ContourInfo): Point[] {
    const { corners } = contourInfo;

    if (corners.length === 4) {
      return this.sortCornersClockwise(corners);
    }

    // If not exactly 4 corners, try to find the best 4
    if (corners.length > 4) {
      return this.selectBestFourCorners(corners);
    }

    // If fewer than 4 corners, return as is (will be handled by validation)
    return corners;
  }

  /**
   * Select the best 4 corners from a contour with more than 4 corners
   */
  private selectBestFourCorners(corners: Point[]): Point[] {
    if (corners.length <= 4) return corners;

    // Find the convex hull (outermost corners)
    const hull = this.convexHull(corners);

    if (hull.length === 4) {
      return this.sortCornersClockwise(hull);
    }

    // If convex hull has more than 4 points, select the 4 most distant from center
    const center = corners.reduce(
      (acc, corner) => ({
        x: acc.x + corner.x / corners.length,
        y: acc.y + corner.y / corners.length
      }),
      { x: 0, y: 0 }
    );

    // Sort by distance from center and take the 4 farthest
    const sortedByDistance = hull.sort((a, b) => {
      const distA = this.calculateDistance(center, a);
      const distB = this.calculateDistance(center, b);
      return distB - distA; // Descending order
    });

    return this.sortCornersClockwise(sortedByDistance.slice(0, 4));
  }

  /**
   * Calculate convex hull using Graham scan algorithm
   */
  private convexHull(points: Point[]): Point[] {
    if (points.length <= 3) return points;

    // Find the point with the lowest y-coordinate (and leftmost if tie)
    const start = points.reduce((lowest, point, index) => {
      if (point.y < points[lowest].y ||
          (point.y === points[lowest].y && point.x < points[lowest].x)) {
        return index;
      }
      return lowest;
    }, 0);

    // Sort points by polar angle with start point
    const sorted = points.slice();
    const startPoint = sorted.splice(start, 1)[0];

    sorted.sort((a, b) => {
      const angleA = Math.atan2(a.y - startPoint.y, a.x - startPoint.x);
      const angleB = Math.atan2(b.y - startPoint.y, b.x - startPoint.x);
      return angleA - angleB;
    });

    // Build convex hull
    const hull = [startPoint];

    for (const point of sorted) {
      while (hull.length >= 2 &&
             this.crossProduct(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
        hull.pop();
      }
      hull.push(point);
    }

    return hull;
  }

  /**
   * Calculate cross product for convex hull
   */
  private crossProduct(o: Point, a: Point, b: Point): number {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }
}
