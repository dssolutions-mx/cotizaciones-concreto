/**
 * Utility functions for parsing SR3 test machine data files
 */

export interface Sr3Result {
  timeData: number[];
  forceData: number[];
  maxForce: number;
  chartData?: any;
  metadata: {
    fileFormat: string;
    separator: string;
    totalPoints?: number;
    headerLines: number;
    dataLines?: number;
  };
  debug?: any;
}

/**
 * Parse the SR3 file and extract relevant data
 * 
 * @param fileContent - The content of the SR3 file as string
 * @param debug - Whether to include debug information in the result
 * @returns Object containing parsed data, including time points, force values and max force
 */
export function parseSr3File(fileContent: string, debug = false): Sr3Result {
  try {
    // Check if file is empty or not a string
    if (!fileContent || typeof fileContent !== 'string') {
      throw new Error('Archivo vacío o inválido');
    }

    // First try to get MAX LOAD directly from header
    const maxLoadMatch = /MAX LOAD:\s*([\d\.]+)\s*tf/i.exec(fileContent);
    let declaredMaxForce = 0;
    
    if (maxLoadMatch && maxLoadMatch[1]) {
      declaredMaxForce = parseFloat(maxLoadMatch[1]) * 1000; // Convert tf to kg
      if (debug) {
        console.log(`Found declared MAX LOAD: ${declaredMaxForce} kg`);
      }
    }

    // Debug information
    const debugInfo = {
      fileSizeBytes: fileContent.length,
      totalLines: 0,
      headerLines: 0,
      dataLines: 0,
      validDataPoints: 0,
      firstFewLines: [] as string[],
      possibleDataSamples: [] as {line: string, parsed: any}[],
      parsingErrors: [] as string[],
      isBinary: false,
      detectedFormat: 'unknown'
    };

    // Check if file might be binary (contains null bytes or non-printable chars)
    debugInfo.isBinary = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(fileContent.substring(0, 1000));
    
    // Split content into lines
    const lines = fileContent.split('\n');
    debugInfo.totalLines = lines.length;
    
    // Store first few lines for debugging
    debugInfo.firstFewLines = lines.slice(0, Math.min(40, lines.length)).map(line => line.trim());
    
    // Check if the file appears to be in the expected format
    if (lines.length < 10) {
      if (debug) {
        debugInfo.parsingErrors.push('Not enough lines in file');
      }
      throw new Error('El archivo no contiene suficientes datos para analizar');
    }
    
    // Try to determine if this is a text-based SR3 file with a header
    const headerInfo = detectHeaderFormat(lines, true);
    const hasHeader = headerInfo.hasHeader;
    debugInfo.detectedFormat = hasHeader ? 'text_with_header' : 'text_data_only';
    
    if (debug) {
      debugInfo.headerLines = headerInfo.headerLines;
      
      // Add header detection info
      debugInfo.parsingErrors.push(
        ...headerInfo.detectionNotes.map(note => `Header detection: ${note}`)
      );
    }
    
    // Number of header lines to skip
    const headerLines = hasHeader ? headerInfo.headerLines : 0;
    
    // Extract data points
    let timeData: number[] = [];
    let forceData: number[] = [];
    let maxForce = 0;
    
    // SR3 files have a specific format where all force data is on one long line,
    // followed by all time data on the next line (both semicolon-separated)
    
    // Look for lines with many semicolon-separated values after the header
    let dataLineFound = false;
    
    // First look for the force data (usually the first long line with many semicolons)
    for (let i = headerLines; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Check if this line contains many semicolons and numbers (likely force data)
      if (line.split(';').length > 10) {
        // This is likely our force data line
        const forceParts = line.split(';').map(part => part.trim()).filter(Boolean);
        
        forceData = forceParts
          .map(part => parseFloat(part))
          .filter(val => !isNaN(val));
        
        if (debug) {
          debugInfo.parsingErrors.push(`Found force data line at line ${i+1} with ${forceData.length} values`);
        }
        
        // Now look for time data line (should be next non-empty line)
        for (let j = i + 1; j < lines.length; j++) {
          const timeLine = lines[j].trim();
          if (!timeLine) continue;
          
          // Check if this line also contains many semicolons and numbers
          if (timeLine.split(';').length > 10) {
            const timeParts = timeLine.split(';').map(part => part.trim()).filter(Boolean);
            
            timeData = timeParts
              .map(part => parseFloat(part))
              .filter(val => !isNaN(val));
            
            if (debug) {
              debugInfo.parsingErrors.push(`Found time data line at line ${j+1} with ${timeData.length} values`);
            }
            
            dataLineFound = true;
            break;
          }
        }
        
        if (dataLineFound) break;
      }
    }
    
    // If we didn't find data in the expected format, try the old approach of looking for columns
    if (!dataLineFound || forceData.length === 0) {
      if (debug) {
        debugInfo.parsingErrors.push('Could not find data in expected format, trying alternative parsing');
      }
      
      // Try different separators to find the one that works best
      const possibleSeparators = [/\s+/, /,/, /;/, /\t/];
      const separatorCounts = possibleSeparators.map(() => 0);
      
      // First pass - determine best separator
      for (let i = headerLines; i < Math.min(headerLines + 20, lines.length); i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        for (let s = 0; s < possibleSeparators.length; s++) {
          const columns = line.split(possibleSeparators[s]);
          if (columns.length >= 2) {
            const first = parseFloat(columns[0]);
            const second = parseFloat(columns[1]);
            
            if (!isNaN(first) && !isNaN(second)) {
              separatorCounts[s]++;
              
              if (debug) {
                debugInfo.possibleDataSamples.push({
                  line,
                  parsed: { 
                    separator: possibleSeparators[s].toString(),
                    values: columns.map(c => parseFloat(c)),
                    valid: true
                  }
                });
              }
            }
          }
        }
      }
      
      // Find the separator with the most successful parses
      const bestSeparatorIndex = separatorCounts.indexOf(Math.max(...separatorCounts));
      const separator = possibleSeparators[bestSeparatorIndex] || /\s+/;
      
      // Process data lines with the selected separator
      timeData = [];
      forceData = [];
      let dataLinesCount = 0;
      let validPointsCount = 0;
      
      for (let i = headerLines; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (!line) continue;
        
        dataLinesCount++;
        
        // Use the best separator to extract data
        const columns = line.split(separator);
        
        let parsedSuccessfully = false;
        
        // Use column indices based on the number of columns
        if (columns.length >= 2) {
          // Default: first column is time, second is force
          let timeIndex = 0;
          let forceIndex = 1;
          
          // Try to parse as numbers
          const time = parseFloat(columns[timeIndex]);
          const force = parseFloat(columns[forceIndex]);
          
          if (!isNaN(time) && !isNaN(force)) {
            timeData.push(time);
            forceData.push(force);
            validPointsCount++;
            
            parsedSuccessfully = true;
          }
        }
        
        // Log parsing failures for debugging
        if (debug && !parsedSuccessfully && dataLinesCount < 10) {
          debugInfo.parsingErrors.push(`Failed to parse line ${i+1}: ${line}`);
        }
      }
      
      debugInfo.dataLines = dataLinesCount;
      debugInfo.validDataPoints = validPointsCount;
    } else {
      debugInfo.validDataPoints = Math.min(timeData.length, forceData.length);
    }
    
    // Ensure time and force data arrays have the same length
    const minLength = Math.min(timeData.length, forceData.length);
    if (minLength === 0) {
      if (debug) {
        debugInfo.parsingErrors.push('No valid data points extracted');
      }
      throw new Error('No se pudieron extraer datos válidos del archivo');
    }
    
    // Truncate arrays to same length if needed
    if (timeData.length !== forceData.length) {
      if (debug) {
        debugInfo.parsingErrors.push(`Time data (${timeData.length}) and force data (${forceData.length}) length mismatch, truncating to ${minLength}`);
      }
      timeData = timeData.slice(0, minLength);
      forceData = forceData.slice(0, minLength);
    }
    
    // Find the maximum force value
    maxForce = Math.max(...forceData.map(f => Math.abs(f)));
    
    // Prepare chart data
    const chartData = {
      labels: timeData,
      datasets: [
        {
          label: 'Fuerza (kg)',
          data: forceData,
          borderColor: 'rgb(53, 162, 235)',
          backgroundColor: 'rgba(53, 162, 235, 0.5)',
        },
      ],
    };
    
    // If we found a declared max force in the header, use that
    const result: Sr3Result = {
      timeData,
      forceData,
      maxForce: declaredMaxForce > 0 ? declaredMaxForce : maxForce,
      chartData,
      metadata: {
        fileFormat: debugInfo.detectedFormat,
        separator: ';',
        totalPoints: minLength,
        headerLines: headerLines
      }
    };
    
    if (debug) {
      result.debug = debugInfo;
    }
    
    return result;
  } catch (err) {
    console.error('Error parsing SR3 file:', err);
    throw new Error('Error al analizar el archivo SR3');
  }
}

/**
 * Extracts the maximum force from a raw SR3 file directly using regex
 */
export function extractMaxForce(rawData: string): number {
  // Try to find MAX LOAD declaration in header directly
  const maxLoadMatch = /MAX LOAD:\s*([\d\.]+)\s*tf/i.exec(rawData);
  if (maxLoadMatch && maxLoadMatch[1]) {
    const value = parseFloat(maxLoadMatch[1]);
    // Convert tf to kg (1 tf = 1000 kg)
    return value * 1000;
  }

  // If not in header, try to extract from data points
  try {
    const result = parseSr3File(rawData);
    return result.maxForce;
  } catch (e) {
    console.error('Failed to extract max force:', e);
    return 0;
  }
}

/**
 * Attempt to detect the header format in the SR3 file
 * 
 * @param lines - Array of lines from the file
 * @param debug - Whether to include debug information
 * @returns Object with header detection results
 */
function detectHeaderFormat(lines: string[], debug = false): { 
  hasHeader: boolean; 
  headerLines: number;
  detectionNotes: string[];
} {
  const result = {
    hasHeader: true,
    headerLines: 5, // Default assumption
    detectionNotes: [] as string[]
  };
  
  // Check for common header patterns in SR3 files
  let lastHeaderLine = 0;
  let foundDataSection = false;
  
  // Look for specific patterns that indicate the end of the header section
  for (let i = 0; i < Math.min(50, lines.length); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Check for header metadata lines (typically key-value pairs ending with semicolons)
    if (line.includes(':') && line.endsWith(';')) {
      lastHeaderLine = i;
      if (debug) {
        result.detectionNotes.push(`Line ${i+1} appears to be a header line: ${line}`);
      }
    }
    
    // Check for OVERSAMPLING READINGS entry which typically marks the end of the header
    if (line.includes('OVERSAMPLING READINGS')) {
      lastHeaderLine = i;
      if (debug) {
        result.detectionNotes.push(`Found end of header marker at line ${i+1}: ${line}`);
      }
    }
    
    // Check if we've reached what looks like the data section
    // (long line with many semicolon-separated values)
    if (line.split(';').length > 10) {
      // Check if the values look like numbers
      const parts = line.split(';').map(part => part.trim()).filter(Boolean);
      const numericParts = parts.filter(part => !isNaN(parseFloat(part)));
      
      if (numericParts.length > 10) {
        foundDataSection = true;
        if (debug) {
          result.detectionNotes.push(`Found start of data section at line ${i+1}`);
        }
        break;
      }
    }
  }
  
  // Set header size based on analysis
  if (foundDataSection) {
    result.headerLines = lastHeaderLine + 1;
    if (debug) {
      result.detectionNotes.push(`Setting header size to ${result.headerLines} lines`);
    }
  } else {
    // Fallback to default if we couldn't find a clear pattern
    result.headerLines = 34; // Common header size in sample files
    if (debug) {
      result.detectionNotes.push(`Using default header size of ${result.headerLines} lines`);
    }
  }
  
  return result;
} 