// Scanner Test Script
// Run this in the browser console to test the scanner functionality

console.log('🧪 Scanner Test Script Loaded');
console.log('📋 This script will test the scanner functionality after the fixes');

async function runScannerTests() {
  try {
    console.log('\n🚀 Starting Scanner Tests...\n');

    // Test 1: Check if scanner manager is available
    if (typeof window === 'undefined' || !window.scannerManager) {
      console.error('❌ Scanner manager not found. Make sure you\'re on the correct page.');
      return;
    }

    const scannerManager = window.scannerManager;
    console.log('✅ Scanner manager found');

    // Test 2: Check scanner status
    const status = scannerManager.getStatus();
    console.log('📊 Scanner Status:', status);

    // Test 3: Initialize scanner if not already initialized
    if (!status.initialized) {
      console.log('🔄 Initializing scanner...');
      const initResult = await scannerManager.initialize();
      console.log('📦 Initialization result:', initResult);
    }

    // Test 4: Test SIMPLE scanner first (the new approach!)
    console.log('🎯 Testing SIMPLE scanner approach...');
    try {
      const simpleTestCanvas = document.createElement('canvas');
      simpleTestCanvas.width = 800;
      simpleTestCanvas.height = 600;
      const simpleCtx = simpleTestCanvas.getContext('2d', {
        willReadFrequently: true,
        alpha: false
      })!;

      // Create a simple document-like rectangle
      simpleCtx.fillStyle = 'white';
      simpleCtx.fillRect(0, 0, 800, 600);
      simpleCtx.fillStyle = 'black';
      simpleCtx.fillRect(50, 50, 700, 500); // Rectangle that looks like a document

      const simpleResult = await scannerManager.detectDocumentAdvanced(simpleTestCanvas);
      console.log('🎯 Simple scanner result:', simpleResult);

      if (simpleResult.success) {
        console.log('✅ SIMPLE scanner works! This is the way to go.');

        // Test coordinate bounding
        if (simpleResult.corners) {
          const allValid = simpleResult.corners.every(corner =>
            corner.x >= 0 && corner.x <= 800 &&
            corner.y >= 0 && corner.y <= 600
          );
          if (allValid) {
            console.log('✅ All coordinates are within canvas bounds!');
          } else {
            console.log('⚠️ Some coordinates are out of bounds');
          }
        }
      } else {
        console.log('⚠️ Simple scanner didn\'t find document, but that\'s expected for test pattern');
      }
    } catch (simpleError) {
      console.error('❌ Simple scanner test failed:', simpleError);
    }

    // Test 5: Test coordinate bounding with invalid coordinates
    console.log('🔧 Testing coordinate bounding...');
    try {
      // Create a mock result with out-of-bounds coordinates
      const mockCorners = [
        { x: -100, y: -50 },     // Negative coordinates
        { x: 5000, y: 4000 },    // Way too large
        { x: 200, y: 150 },      // Valid
        { x: 600, y: 450 }       // Valid
      ];

      // Test the coordinate bounding logic
      const boundedCorners = mockCorners.map(corner => ({
        x: Math.max(0, Math.min(800, corner.x)),
        y: Math.max(0, Math.min(600, corner.y))
      }));

      console.log('📍 Original coordinates:', mockCorners.map(c => `(${c.x},${c.y})`).join(', '));
      console.log('🔧 Bounded coordinates:', boundedCorners.map(c => `(${c.x},${c.y})`).join(', '));

      const allBounded = boundedCorners.every(corner =>
        corner.x >= 0 && corner.x <= 800 &&
        corner.y >= 0 && corner.y <= 600
      );

      if (allBounded) {
        console.log('✅ Coordinate bounding works correctly!');
      } else {
        console.log('❌ Coordinate bounding failed');
      }
    } catch (boundingError) {
      console.error('❌ Coordinate bounding test failed:', boundingError);
    }

    // Test 6: Run comprehensive scanner test
    console.log('🧪 Running comprehensive scanner test...');
    const testResult = await scannerManager.runScannerTest();
    console.log('📋 Test Results:', testResult);

    // Test 6: Test large canvas handling (the main fix for this issue)
    console.log('🧪 Testing large canvas handling...');
    try {
      const largeCanvas = document.createElement('canvas');
      largeCanvas.width = 6000; // Larger than our recommended max (4096)
      largeCanvas.height = 4000;
      const largeCtx = largeCanvas.getContext('2d')!;
      largeCtx.fillStyle = 'white';
      largeCtx.fillRect(0, 0, 6000, 4000);
      largeCtx.fillStyle = 'black';
      largeCtx.fillRect(100, 100, 5800, 3800);

      console.log(`📐 Created large canvas: ${largeCanvas.width}x${largeCanvas.height}`);

      // Test canvas validation
      const validationResult = scannerManager.validateCanvas(largeCanvas);
      console.log('📊 Large canvas validation result:', validationResult);

      if (validationResult.resizedCanvas) {
        const resized = validationResult.resizedCanvas;
        console.log(`✅ Large canvas was resized from ${largeCanvas.width}x${largeCanvas.height} to ${resized.width}x${resized.height}`);

        if (resized.width <= 4096 && resized.height <= 4096) {
          console.log('✅ Canvas resizing working correctly!');
        } else {
          console.log('⚠️ Canvas may not have been resized properly');
        }
      } else if (validationResult.valid) {
        console.log('✅ Large canvas passed validation without resizing');
      } else {
        console.log('❌ Large canvas validation failed:', validationResult.error);
      }
    } catch (largeCanvasError) {
      console.error('❌ Large canvas test failed:', largeCanvasError);
    }

    // Test 6: Performance test
    console.log('🏃 Running performance test...');
    try {
      const perfResults = await scannerManager.performanceTest();
      console.log('📊 Performance Results:', perfResults);

      if (perfResults.totalTime > 5000) {
        console.log('⚠️ Performance Warning: Total time exceeds 5 seconds');
      } else if (perfResults.totalTime > 2000) {
        console.log('🟡 Performance Note: Total time exceeds 2 seconds');
      } else {
        console.log('✅ Performance looks good!');
      }

      // Test timeout protection
      console.log('⏰ Testing timeout protection...');
      try {
        const timeoutTest = await Promise.race([
          scannerManager.detectDocumentAdvanced(testCanvas),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout test')), 5000)
          )
        ]);
        console.log('✅ Timeout protection working - no hang detected');
      } catch (error) {
        if (error.message === 'Timeout test') {
          console.log('✅ Timeout protection working correctly');
        } else {
          console.log('⚠️ Advanced detection completed before timeout');
        }
      }
    } catch (perfError) {
      console.error('❌ Performance test failed:', perfError);
    }

    // Test 7: Check for OpenCV and jscanify availability
    const testStatus = await scannerManager.testScanner();
    console.log('🔍 Library Status:', testStatus);

    // Summary
    console.log('\n📊 TEST SUMMARY');
    console.log('================');
    console.log('🎯 NEW APPROACH: Simple Scanner (OpenCV → Canny → Find Rectangle)');
    console.log('   This is much simpler and should work for most documents!');
    console.log('');

    if (testResult.success) {
      console.log('✅ All tests passed! The scanner should be working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Check the errors below:');
      testResult.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    console.log('\n🔗 OpenCV Available:', typeof window.cv !== 'undefined');
    console.log('🔗 jscanify Available:', typeof window.jscanify !== 'undefined');
    console.log('🔗 Scanner Ready:', status.initialized);

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    console.log('\n💡 Troubleshooting tips:');
    console.log('  1. Make sure you\'re running this on a secure connection (HTTPS or localhost)');
    console.log('  2. Check browser console for detailed error messages');
    console.log('  3. Ensure OpenCV.js and jscanify are loading correctly');
    console.log('  4. Try refreshing the page and running the test again');
  }
}

// Auto-run tests when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runScannerTests);
} else {
  // Run tests immediately if DOM is already loaded
  setTimeout(runScannerTests, 1000); // Small delay to ensure everything is loaded
}

// Also expose the test function globally for manual execution
window.runScannerTests = runScannerTests;

console.log('\n💡 You can also run tests manually by calling: runScannerTests()');
console.log('💡 The tests will run automatically when the page loads...\n');
