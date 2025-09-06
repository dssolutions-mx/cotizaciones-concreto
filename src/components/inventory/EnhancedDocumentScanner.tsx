'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  scannerManager,
  ScannerManager,
  DocumentDetectionResult,
  EnhancedProcessingResult,
  MultiScaleResult,
  CornerRefinementResult,
  DocumentQualityMetrics
} from './scanner';

/**
 * Enhanced Document Scanner Component
 * Implements advanced edge detection algorithms for robust document scanning
 */
const EnhancedDocumentScanner: React.FC = () => {
  const [scanner, setScanner] = useState<ScannerManager | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<DocumentDetectionResult | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<string[]>([]);
  const [detectionMethod, setDetectionMethod] = useState<'basic' | 'enhanced'>('enhanced');
  const [qualityMetrics, setQualityMetrics] = useState<DocumentQualityMetrics | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize scanner on component mount
  useEffect(() => {
    const initScanner = async () => {
      try {
        setProcessingSteps(['Initializing scanner...']);
        const initResult = await scannerManager.initialize();

        if (initResult.success) {
          setScanner(scannerManager);
          setProcessingSteps(['Scanner initialized successfully']);
        } else {
          setProcessingSteps([`Scanner initialization failed: ${initResult.error}`]);
        }
      } catch (error) {
        setProcessingSteps([`Scanner initialization error: ${error}`]);
      }
    };

    initScanner();
  }, []);

  // Enhanced document detection pipeline
  const enhancedDocumentDetection = useCallback(async (canvas: HTMLCanvasElement) => {
    if (!scanner) return null;

    setIsProcessing(true);
    const steps: string[] = [];

    try {
      // Choose detection method based on user preference
      if (detectionMethod === 'enhanced') {
        steps.push("Starting enhanced document detection...");
        setProcessingSteps([...steps]);

        const detectionResult = await scanner.detectDocumentEnhanced(canvas, debugMode);

        if (detectionResult.success) {
          steps.push("Document detected successfully");
          setProcessingSteps([...steps]);

          // Calculate quality metrics
          const metrics = await calculateQualityMetrics(canvas);
          setQualityMetrics(metrics);

          return detectionResult;
        } else {
          steps.push("Enhanced detection failed, trying basic detection...");
          setProcessingSteps([...steps]);
        }
      }

      // Fallback to basic detection
      steps.push("Using basic document detection...");
      setProcessingSteps([...steps]);

      const basicResult = await scanner.detectDocument(canvas);

      if (basicResult.success) {
        steps.push("Basic detection successful");
      } else {
        steps.push("All detection methods failed");
      }

      setProcessingSteps([...steps]);
      return basicResult;

    } catch (error) {
      steps.push(`Error: ${error}`);
      setProcessingSteps([...steps]);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [scanner, detectionMethod, debugMode]);

  // Calculate quality metrics for the document
  const calculateQualityMetrics = useCallback(async (canvas: HTMLCanvasElement): Promise<DocumentQualityMetrics | null> => {
    if (!scanner) return null;

    try {
      // Use the advanced image processor to analyze quality
      const advancedProcessor = (scanner as any).advancedProcessor;
      if (advancedProcessor && typeof advancedProcessor.analyzeDocumentQuality === 'function') {
        return advancedProcessor.analyzeDocumentQuality(canvas);
      }
      return null;
    } catch (error) {
      console.warn('Quality analysis failed:', error);
      return null;
    }
  }, [scanner]);

  // Process uploaded image
  const processImage = useCallback(async (imageElement: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    ctx.drawImage(imageElement, 0, 0);

    const detectionResult = await enhancedDocumentDetection(canvas);
    setResult(detectionResult || null);
  }, [enhancedDocumentDetection]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => processImage(img);
    img.src = URL.createObjectURL(file);
  }, [processImage]);

  // Handle camera capture
  const handleCameraCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const detectionResult = await enhancedDocumentDetection(canvas);
    setResult(detectionResult || null);
  }, [enhancedDocumentDetection]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera access failed:', error);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  }, []);

  // Extract document using detected corners
  const extractDocument = useCallback(async () => {
    if (!scanner || !result?.corners || !canvasRef.current) return;

    try {
      setProcessingSteps(['Extracting document...']);
      const extracted = await scanner.extractDocument(canvasRef.current, result.corners);

      if (extracted) {
        setProcessingSteps(['Document extracted successfully']);
        // Here you could save the extracted document or display it
        console.log('Document extracted:', extracted);
      } else {
        setProcessingSteps(['Document extraction failed']);
      }
    } catch (error) {
      setProcessingSteps([`Extraction error: ${error}`]);
    }
  }, [scanner, result]);

  // Get quality score color
  const getQualityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get quality label
  const getQualityLabel = (score: number) => {
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    if (score >= 0.4) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Enhanced Document Scanner</h1>
          <div className="flex items-center gap-4">
            <select
              value={detectionMethod}
              onChange={(e) => setDetectionMethod(e.target.value as 'basic' | 'enhanced')}
              className="px-3 py-1 border rounded-md text-sm"
            >
              <option value="enhanced">Enhanced Detection</option>
              <option value="basic">Basic Detection</option>
            </select>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={debugMode}
                onChange={(e) => setDebugMode(e.target.checked)}
                className="mr-2"
              />
              Debug Mode
            </label>
          </div>
        </div>

        {/* Camera Interface */}
        <div className="mb-6">
          <div className="flex gap-4 mb-4">
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Start Camera
            </button>
            <button
              onClick={stopCamera}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              Stop Camera
            </button>
            <button
              onClick={handleCameraCapture}
              disabled={!videoRef.current?.srcObject || isProcessing}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
            >
              Capture
            </button>
          </div>

          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full max-w-2xl mx-auto border rounded-lg"
          />
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-blue-800">Processing...</span>
            </div>
          </div>
        )}

        {/* Debug Information */}
        {debugMode && processingSteps.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
            <h3 className="font-medium mb-2">Processing Steps:</h3>
            <ul className="text-sm space-y-1">
              {processingSteps.map((step, index) => (
                <li key={index} className="text-gray-700">
                  {index + 1}. {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            <div className={`border rounded-md p-4 ${
              result.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`font-medium ${
                  result.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {result.success
                    ? 'Document detected successfully!'
                    : 'Document detection failed'
                  }
                </span>
                {result.confidence && (
                  <span className={`text-sm ${
                    result.success ? 'text-green-600' : 'text-red-600'
                  }`}>
                    Confidence: {(result.confidence * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              {result.method && (
                <div className="text-sm text-gray-600 mt-1">
                  Method: {result.method}
                </div>
              )}
            </div>

            {/* Quality Metrics */}
            {qualityMetrics && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h3 className="font-medium mb-2">Document Quality Analysis</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Brightness</div>
                    <div className={getQualityColor(qualityMetrics.brightness)}>
                      {(qualityMetrics.brightness * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Contrast</div>
                    <div className={getQualityColor(qualityMetrics.contrast)}>
                      {(qualityMetrics.contrast * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Sharpness</div>
                    <div className={getQualityColor(qualityMetrics.sharpness)}>
                      {(qualityMetrics.sharpness * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Overall</div>
                    <div className={getQualityColor(qualityMetrics.overallQuality)}>
                      {getQualityLabel(qualityMetrics.overallQuality)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Detected Corners */}
            {result.corners && (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                <h3 className="font-medium mb-2">Detected Corners</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {result.corners.map((corner, index) => (
                    <div key={index} className="bg-white p-2 rounded border">
                      <div className="font-medium">Corner {index + 1}</div>
                      <div className="text-gray-600">
                        ({corner.x.toFixed(0)}, {corner.y.toFixed(0)})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {result.success && result.corners && (
              <div className="flex gap-4">
                <button
                  onClick={extractDocument}
                  className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
                >
                  Extract Document
                </button>
                <button
                  onClick={() => {
                    if (canvasRef.current && result.corners) {
                      scanner?.highlightDocument(canvasRef.current, result.corners, '#00ff00', 3);
                    }
                  }}
                  className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
                >
                  Highlight Document
                </button>
              </div>
            )}

            {/* Error Message */}
            {result.error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <h3 className="font-medium text-red-800 mb-2">Error</h3>
                <p className="text-red-700">{result.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedDocumentScanner;
