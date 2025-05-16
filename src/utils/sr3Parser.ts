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
      console.error('[SR3Parser] Empty or invalid file content');
      throw new Error('Archivo vacío o inválido');
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
      detectedFormat: 'unknown',
      processingLog: [] as string[],
    };

    // First try to get MAX LOAD directly from header
    const maxLoadMatch = /MAX LOAD:\s*([\d\.]+)\s*tf/i.exec(fileContent);
    let declaredMaxForce = 0;
    
    if (maxLoadMatch && maxLoadMatch[1]) {
      declaredMaxForce = parseFloat(maxLoadMatch[1]) * 1000; // Convert tf to kg
      debugInfo.processingLog.push(`Found declared MAX LOAD: ${declaredMaxForce} kg`);
    } else {
      debugInfo.processingLog.push('No MAX LOAD declaration found in header');
    }

    // Check if file might be binary (contains null bytes or non-printable chars)
    debugInfo.isBinary = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(fileContent.substring(0, 1000));
    
    // Split content into lines
    const lines = fileContent.split('\n');
    debugInfo.totalLines = lines.length;
    debugInfo.processingLog.push(`File has ${lines.length} lines`);
    
    // Store first few lines for debugging
    debugInfo.firstFewLines = lines.slice(0, Math.min(40, lines.length)).map(line => line.trim());
    
    // Check if the file appears to be in the expected format
    if (lines.length < 10) {
      debugInfo.processingLog.push('Not enough lines in file');
      throw new Error('El archivo no contiene suficientes datos para analizar');
    }
    
    // Try to determine if this is a text-based SR3 file with a header
    const headerInfo = detectHeaderFormat(lines, true);
    const hasHeader = headerInfo.hasHeader;
    debugInfo.detectedFormat = hasHeader ? 'text_with_header' : 'text_data_only';
    
    debugInfo.headerLines = headerInfo.headerLines;
    debugInfo.processingLog.push(`Header detection: ${hasHeader ? 'Found header' : 'No header'}, ${headerInfo.headerLines} lines`);
      
    // Add header detection info
    debugInfo.parsingErrors.push(
      ...headerInfo.detectionNotes.map(note => `Header detection: ${note}`)
    );
    
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
    
    debugInfo.processingLog.push('Starting to look for data lines');
    
    // First look for the force data (usually the first long line with many semicolons)
    for (let i = headerLines; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Check if this line contains many semicolons and numbers (likely force data)
      const semicolonCount = (line.match(/;/g) || []).length;
      if (semicolonCount > 10) {
        debugInfo.processingLog.push(`Potential data line at ${i+1}: found ${semicolonCount} semicolons`);
        
        // This is likely our force data line
        const forceParts = line.split(';').map(part => part.trim()).filter(Boolean);
        
        // Check if parts look like numbers
        const potentialForceData = forceParts
          .map(part => parseFloat(part))
          .filter(val => !isNaN(val));
        
        if (potentialForceData.length > 10) {
          forceData = potentialForceData;
          debugInfo.processingLog.push(`Found force data line at line ${i+1} with ${forceData.length} values`);
          
          // Now look for time data line (should be next non-empty line)
          for (let j = i + 1; j < lines.length; j++) {
            const timeLine = lines[j].trim();
            if (!timeLine) continue;
            
            // Check if this line also contains many semicolons and numbers
            const timeLineSemicolonCount = (timeLine.match(/;/g) || []).length;
            if (timeLineSemicolonCount > 10) {
              debugInfo.processingLog.push(`Potential time line at ${j+1}: found ${timeLineSemicolonCount} semicolons`);
              
              const timeParts = timeLine.split(';').map(part => part.trim()).filter(Boolean);
              
              // Check if parts look like numbers
              const potentialTimeData = timeParts
                .map(part => parseFloat(part))
                .filter(val => !isNaN(val));
              
              if (potentialTimeData.length > 10) {
                timeData = potentialTimeData;
                debugInfo.processingLog.push(`Found time data line at line ${j+1} with ${timeData.length} values`);
                dataLineFound = true;
                break;
              } else {
                debugInfo.processingLog.push(`Line ${j+1} has semicolons but couldn't parse enough numbers: ${potentialTimeData.length} valid values`);
              }
            }
          }
          
          if (dataLineFound) break;
        } else {
          debugInfo.processingLog.push(`Line ${i+1} has semicolons but couldn't parse enough numbers: ${potentialForceData.length} valid values`);
        }
      }
    }
    
    // If we didn't find data in the expected format, try a more aggressive approach
    if (!dataLineFound || forceData.length === 0) {
      debugInfo.processingLog.push('Could not find data in expected format, trying alternative parsing');
      
      // Try to find any line with a lot of numbers separated by any delimiter
      for (let i = headerLines; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.length < 50) continue; // Skip short lines
        
        // Try different delimiters
        const delimiters = [';', ',', ' ', '\t'];
        
        for (const delimiter of delimiters) {
          const parts = line.split(delimiter).map(part => part.trim()).filter(Boolean);
          if (parts.length > 10) {
            const numbers = parts.map(part => parseFloat(part)).filter(val => !isNaN(val));
            
            if (numbers.length > 10) {
              debugInfo.processingLog.push(`Found potential data line using delimiter '${delimiter}': ${numbers.length} values`);
              
              // If we haven't found force data yet, use this
              if (forceData.length === 0) {
                forceData = numbers;
                debugInfo.processingLog.push(`Using as force data: ${numbers.length} values`);
              } 
              // Otherwise, if we have force but not time, use this as time
              else if (timeData.length === 0) {
                timeData = numbers;
                debugInfo.processingLog.push(`Using as time data: ${numbers.length} values`);
                dataLineFound = true;
                break;
              }
            }
          }
        }
        
        if (forceData.length > 0 && timeData.length > 0) {
          break;
        }
      }
      
      // If we still can't find both, try assuming simple sequential time values
      if (forceData.length > 0 && timeData.length === 0) {
        debugInfo.processingLog.push(`Found force data (${forceData.length} values) but no time data, generating sequential time values`);
        timeData = Array.from({ length: forceData.length }, (_, i) => i * 0.25); // Assume 0.25 second intervals
        dataLineFound = true;
      }
    }
    
    // If we still don't have data, try the columnar approach as a last resort
    if (!dataLineFound || forceData.length === 0) {
      debugInfo.processingLog.push('No data lines found using semicolon parsing, trying columnar data format');
      
      // Try different separators to find the one that works best
      const possibleSeparators = [/\s+/, /,/, /;/, /\t/];
      const separatorCounts = possibleSeparators.map(() => 0);
      
      // First pass - determine best separator
      for (let i = headerLines; i < Math.min(headerLines + 30, lines.length); i++) {
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
      
      debugInfo.processingLog.push(`Best separator for columnar format: ${separator}`);
      
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
      
      debugInfo.processingLog.push(`Columnar parsing found ${validPointsCount} valid data points`);
    } else {
      debugInfo.validDataPoints = Math.min(timeData.length, forceData.length);
    }
    
    // Ensure time and force data arrays have the same length
    const minLength = Math.min(timeData.length, forceData.length);
    if (minLength === 0) {
      if (declaredMaxForce > 0) {
        // If we have a declared max force but no data points, we'll use that
        debugInfo.processingLog.push('No valid data points extracted, but we have a declared max force');
        
        // Generate some fake data for visualization
        timeData = [0, 1];
        forceData = [0, declaredMaxForce];
      } else {
        debugInfo.processingLog.push('No valid data points extracted and no declared max force');
        throw new Error('No se pudieron extraer datos válidos del archivo');
      }
    } else {
      // Truncate arrays to same length if needed
      if (timeData.length !== forceData.length) {
        debugInfo.processingLog.push(`Time data (${timeData.length}) and force data (${forceData.length}) length mismatch, truncating to ${minLength}`);
        timeData = timeData.slice(0, minLength);
        forceData = forceData.slice(0, minLength);
      }
    }
    
    // Find the maximum force value
    maxForce = Math.max(...forceData.map(f => Math.abs(f)));
    debugInfo.processingLog.push(`Calculated max force from data: ${maxForce} kg`);
    
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
    // For production safety, make sure it's reasonable
    if (declaredMaxForce > 0 && declaredMaxForce < 1000000) {  // Sanity check: less than 1000 tons
      debugInfo.processingLog.push(`Using declared max force: ${declaredMaxForce} kg`);
      maxForce = declaredMaxForce;
    } else if (maxForce > 0) {
      debugInfo.processingLog.push(`Using calculated max force: ${maxForce} kg`);
    } else if (declaredMaxForce > 0) {
      debugInfo.processingLog.push(`Falling back to declared max force: ${declaredMaxForce} kg`);
      maxForce = declaredMaxForce;
    } else {
      debugInfo.processingLog.push('No valid force value found');
      throw new Error('No se pudo determinar la fuerza máxima');
    }
    
    const result: Sr3Result = {
      timeData,
      forceData,
      maxForce, 
      chartData,
      metadata: {
        fileFormat: debugInfo.detectedFormat,
        separator: ';',
        totalPoints: timeData.length,
        headerLines: headerLines
      }
    };
    
    // Add debug information
    if (debug) {
      result.debug = debugInfo;
    }
    
    return result;
  } catch (err) {
    console.error('[SR3Parser] Error parsing SR3 file:', err);
    throw new Error('Error al analizar el archivo SR3: ' + (err instanceof Error ? err.message : String(err)));
  }
}

/**
 * Extracts the maximum force from a raw SR3 file directly using regex
 */
export function extractMaxForce(rawData: string): number {
  try {
    // Try to find MAX LOAD declaration in header directly
    const maxLoadMatch = /MAX LOAD:\s*([\d\.]+)\s*tf/i.exec(rawData);
    if (maxLoadMatch && maxLoadMatch[1]) {
      const value = parseFloat(maxLoadMatch[1]);
      // Convert tf to kg (1 tf = 1000 kg)
      return value * 1000;
    }

    // Try to find other possible formats for max load
    const altFormats = [
      /MAX(?:IMUM)?\s*(?:LOAD|FORCE|CARGA):\s*([\d\.]+)\s*(?:tf|ton|t|kg|kgf)/i,
      /CARGA\s*(?:MAXIMA|MÁX):\s*([\d\.]+)\s*(?:tf|ton|t|kg|kgf)/i,
      /FUERZA\s*(?:MAXIMA|MÁX):\s*([\d\.]+)\s*(?:tf|ton|t|kg|kgf)/i
    ];

    for (const regex of altFormats) {
      const match = regex.exec(rawData);
      if (match && match[1]) {
        const value = parseFloat(match[1]);
        // Check if unit is mentioned
        const unit = match[0].toLowerCase();
        // Convert based on unit
        if (unit.includes('tf') || unit.includes('ton') || unit.includes(' t')) {
          return value * 1000; // Convert to kg
        } else {
          return value; // Already in kg
        }
      }
    }

    // If not in header, try to extract from data points
    try {
      const result = parseSr3File(rawData);
      return result.maxForce;
    } catch (e) {
      console.error('[SR3Parser] Failed to extract max force:', e);
      return 0;
    }
  } catch (e) {
    console.error('[SR3Parser] Error in extractMaxForce:', e);
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