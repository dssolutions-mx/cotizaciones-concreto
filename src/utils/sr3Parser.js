"use strict";
/**
 * Utility functions for parsing SR3 test machine data files
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSr3File = parseSr3File;
exports.extractMaxForce = extractMaxForce;
/**
 * Parse the SR3 file and extract relevant data
 *
 * @param fileContent - The content of the SR3 file as string
 * @param debug - Whether to include debug information in the result
 * @returns Object containing parsed data, including time points, force values and max force
 */
function parseSr3File(fileContent, debug) {
    var _a;
    if (debug === void 0) { debug = false; }
    try {
        // Check if file is empty or not a string
        if (!fileContent || typeof fileContent !== 'string') {
            throw new Error('Archivo vacío o inválido');
        }
        // First try to get MAX LOAD directly from header
        var maxLoadMatch = /MAX LOAD:\s*([\d\.]+)\s*tf/i.exec(fileContent);
        var declaredMaxForce = 0;
        if (maxLoadMatch && maxLoadMatch[1]) {
            declaredMaxForce = parseFloat(maxLoadMatch[1]) * 1000; // Convert tf to kg
            if (debug) {
                console.log("Found declared MAX LOAD: ".concat(declaredMaxForce, " kg"));
            }
        }
        // Debug information
        var debugInfo = {
            fileSizeBytes: fileContent.length,
            totalLines: 0,
            headerLines: 0,
            dataLines: 0,
            validDataPoints: 0,
            firstFewLines: [],
            possibleDataSamples: [],
            parsingErrors: [],
            isBinary: false,
            detectedFormat: 'unknown'
        };
        // Check if file might be binary (contains null bytes or non-printable chars)
        debugInfo.isBinary = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(fileContent.substring(0, 1000));
        // Split content into lines
        var lines = fileContent.split('\n');
        debugInfo.totalLines = lines.length;
        // Store first few lines for debugging
        debugInfo.firstFewLines = lines.slice(0, Math.min(20, lines.length)).map(function (line) { return line.trim(); });
        // Check if the file appears to be in the expected format
        if (lines.length < 10) {
            if (debug) {
                debugInfo.parsingErrors.push('Not enough lines in file');
            }
            throw new Error('El archivo no contiene suficientes datos para analizar');
        }
        // Try to determine if this is a text-based SR3 file with a header
        var headerInfo = detectHeaderFormat(lines, true);
        var hasHeader = headerInfo.hasHeader;
        debugInfo.detectedFormat = hasHeader ? 'text_with_header' : 'text_data_only';
        if (debug) {
            debugInfo.headerLines = headerInfo.headerLines;
            // Add header detection info
            (_a = debugInfo.parsingErrors).push.apply(_a, headerInfo.detectionNotes.map(function (note) { return "Header detection: ".concat(note); }));
        }
        // Number of header lines to skip
        var headerLines = hasHeader ? headerInfo.headerLines : 0;
        // Extract data points
        var timeData = [];
        var forceData = [];
        var maxForce = 0;
        var dataLinesCount = 0;
        var validPointsCount = 0;
        var usedSeparator = '';
        // Try different separators to find the one that works best
        var possibleSeparators = [/\s+/, /,/, /;/, /\t/];
        var separatorCounts = possibleSeparators.map(function () { return 0; });
        // First pass - determine best separator
        for (var i = headerLines; i < Math.min(headerLines + 20, lines.length); i++) {
            var line = lines[i].trim();
            if (!line)
                continue;
            for (var s = 0; s < possibleSeparators.length; s++) {
                var columns = line.split(possibleSeparators[s]);
                if (columns.length >= 2) {
                    var first = parseFloat(columns[0]);
                    var second = parseFloat(columns[1]);
                    if (!isNaN(first) && !isNaN(second)) {
                        separatorCounts[s]++;
                        if (debug) {
                            debugInfo.possibleDataSamples.push({
                                line: line,
                                parsed: {
                                    separator: possibleSeparators[s].toString(),
                                    values: columns.map(function (c) { return parseFloat(c); }),
                                    valid: true
                                }
                            });
                        }
                    }
                }
            }
        }
        // Find the separator with the most successful parses
        var bestSeparatorIndex = separatorCounts.indexOf(Math.max.apply(Math, separatorCounts));
        var separator = possibleSeparators[bestSeparatorIndex] || /\s+/;
        usedSeparator = separator.toString();
        // Process data lines with the selected separator
        for (var i = headerLines; i < lines.length; i++) {
            var line = lines[i].trim();
            // Skip empty lines
            if (!line)
                continue;
            dataLinesCount++;
            // Use the best separator to extract data
            var columns = line.split(separator);
            var parsedSuccessfully = false;
            // Use column indices based on the number of columns
            if (columns.length >= 2) {
                // Default: first column is time, second is force
                var timeIndex = 0;
                var forceIndex = 1;
                // If there are more columns, try to identify which ones to use
                if (columns.length > 2) {
                    // Check if a column has "time" or "seconds" in its header
                    for (var c = 0; c < columns.length; c++) {
                        var colLower = columns[c].toLowerCase();
                        if (/time|tiempo|seconds|segundos/i.test(colLower)) {
                            timeIndex = c;
                        }
                        else if (/force|fuerza|load|carga|kg|kn/i.test(colLower)) {
                            forceIndex = c;
                        }
                    }
                }
                // Try to parse as numbers
                var time = parseFloat(columns[timeIndex]);
                var force = parseFloat(columns[forceIndex]);
                if (!isNaN(time) && !isNaN(force)) {
                    timeData.push(time);
                    forceData.push(force);
                    validPointsCount++;
                    // Track maximum force
                    if (force > maxForce) {
                        maxForce = force;
                    }
                    parsedSuccessfully = true;
                }
            }
            // Log parsing failures for debugging
            if (debug && !parsedSuccessfully && dataLinesCount < 10) {
                debugInfo.parsingErrors.push("Failed to parse line ".concat(i + 1, ": ").concat(line));
            }
        }
        debugInfo.dataLines = dataLinesCount;
        debugInfo.validDataPoints = validPointsCount;
        // Check if we extracted any valid data points
        if (timeData.length === 0 || forceData.length === 0) {
            if (debug) {
                debugInfo.parsingErrors.push("No valid data points extracted from ".concat(dataLinesCount, " potential data lines"));
            }
            throw new Error('No se pudieron extraer datos válidos del archivo');
        }
        // Prepare chart data
        var chartData = {
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
        if (declaredMaxForce > 0) {
            return {
                timeData: timeData,
                forceData: forceData,
                maxForce: declaredMaxForce,
                chartData: chartData,
                metadata: {
                    fileFormat: debugInfo.detectedFormat,
                    separator: usedSeparator,
                    totalPoints: validPointsCount,
                    headerLines: headerLines
                }
            };
        }
        else {
            // Otherwise use calculated max from the data points
            return {
                timeData: timeData,
                forceData: forceData,
                maxForce: Math.max.apply(Math, forceData.map(function (f) { return Math.abs(f); })),
                chartData: chartData,
                metadata: {
                    fileFormat: debugInfo.detectedFormat,
                    separator: usedSeparator,
                    totalPoints: validPointsCount,
                    headerLines: headerLines
                }
            };
        }
    }
    catch (err) {
        console.error('Error parsing SR3 file:', err);
        throw new Error('Error al analizar el archivo SR3');
    }
}
/**
 * Extracts the maximum force from a raw SR3 file directly using regex
 */
function extractMaxForce(rawData) {
    // Try to find MAX LOAD declaration in header directly
    var maxLoadMatch = /MAX LOAD:\s*([\d\.]+)\s*tf/i.exec(rawData);
    if (maxLoadMatch && maxLoadMatch[1]) {
        var value = parseFloat(maxLoadMatch[1]);
        // Convert tf to kg (1 tf = 1000 kg)
        return value * 1000;
    }
    // If not in header, try to extract from data points
    try {
        var result = parseSr3File(rawData);
        return result.maxForce;
    }
    catch (e) {
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
function detectHeaderFormat(lines, debug) {
    if (debug === void 0) { debug = false; }
    var result = {
        hasHeader: true,
        headerLines: 5, // Default assumption
        detectionNotes: []
    };
    // Check first few lines for header patterns
    var sampleLines = lines.slice(0, Math.min(20, lines.length));
    // Look for patterns that suggest a header
    var headerPatterns = [
        /test data/i,
        /informe/i,
        /reporte/i,
        /fecha/i,
        /machine/i,
        /máquina/i,
        /time/i,
        /force/i,
        /tiempo/i,
        /fuerza/i,
        /sample/i,
        /muestra/i,
        /specimen/i,
        /espécimen/i,
        /compressive/i,
        /compresión/i,
        /strength/i,
        /resistencia/i,
        /equipment/i,
        /equipo/i
    ];
    // Count how many lines look like headers
    var headerLineCount = 0;
    var firstDataLine = -1;
    for (var i = 0; i < sampleLines.length; i++) {
        var line = sampleLines[i].trim();
        if (!line)
            continue;
        var isHeader = false;
        // Check against header patterns
        for (var _i = 0, headerPatterns_1 = headerPatterns; _i < headerPatterns_1.length; _i++) {
            var pattern = headerPatterns_1[_i];
            if (pattern.test(line)) {
                isHeader = true;
                if (debug) {
                    result.detectionNotes.push("Line ".concat(i + 1, " matches header pattern: ").concat(pattern));
                }
                break;
            }
        }
        // If not matched against patterns, check if it looks like data
        if (!isHeader) {
            var columns = line.split(/[\s,;]+/);
            // If line has at least two columns that parse as numbers, probably data
            if (columns.length >= 2) {
                var firstValue = parseFloat(columns[0]);
                var secondValue = parseFloat(columns[1]);
                if (!isNaN(firstValue) && !isNaN(secondValue)) {
                    if (firstDataLine === -1) {
                        firstDataLine = i;
                        if (debug) {
                            result.detectionNotes.push("First data line appears to be line ".concat(i + 1));
                        }
                    }
                }
                else {
                    // Not a data line, but also not matching any header patterns
                    isHeader = true;
                    if (debug) {
                        result.detectionNotes.push("Line ".concat(i + 1, " doesn't match patterns but doesn't look like data"));
                    }
                }
            }
            else {
                // Not enough columns to be data
                isHeader = true;
                if (debug) {
                    result.detectionNotes.push("Line ".concat(i + 1, " has fewer than 2 columns"));
                }
            }
        }
        if (isHeader) {
            headerLineCount++;
        }
    }
    // Make a decision based on the analysis
    if (firstDataLine === -1) {
        // No obvious data lines found in sample
        result.hasHeader = true;
        result.headerLines = 5; // Default
        if (debug) {
            result.detectionNotes.push("No clear data lines found in sample, assuming default header size");
        }
    }
    else {
        // Data line found, use that as the header boundary
        result.hasHeader = (firstDataLine > 0);
        result.headerLines = firstDataLine;
        if (debug) {
            result.detectionNotes.push("Setting header size to ".concat(firstDataLine, " based on first data line"));
        }
    }
    return result;
}
