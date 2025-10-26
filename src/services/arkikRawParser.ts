import * as XLSX from 'xlsx';
import { ArkikRawRow, ValidationError, ArkikErrorType, ArkikMeasureKey } from '@/types/arkik';

type MaterialColumnBlock = {
  arkikCode: string;
  indicesByMeasure: Record<ArkikMeasureKey, number>;
};

// Helper function to get days in a month (accounting for leap years)
function getDaysInMonth(year: number, month: number): number {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return daysInMonth[month - 1];
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export class ArkikRawParser {
  private static readonly STABLE_HEADERS = {
    orden: /\borden\b/i,
    remision: /remisi[oó]n/i,
    estatus: /estatus/i,
    volumen: /volumen/i,
    // Arkik has two columns: "#Cliente" (code) and "Cliente" (name)
    cliente_codigo: /^\s*#\s*cliente\b/i,
    cliente_nombre: /^(?!\s*#)\s*cliente\b/i,
    rfc: /\brfc\b/i,
    obra: /\bobra\b/i,
    punto_entrega: /punto.*entrega/i,
    prod_comercial: /prod.*comercial/i,
    prod_tecnico: /prod.*t[eé]cnico/i,
    product_description: /descrip/i,
    comentarios_internos: /comentarios.*internos/i,
    comentarios_externos: /comentarios.*externos/i,
    elementos: /elementos/i,
    camion: /cam[ií]on/i,
    placas: /placas/i,
    chofer: /chofer/i,
    // Sometimes "B/NB" instead of "Bombeable"
    bombeable: /(b\/nb|bombeable)/i,
    fecha: /\bfecha\b/i,
    hora_carga: /hora.*carga/i
  } as const;

  private static readonly DEFAULT_MEASURE_ALIASES: Record<ArkikMeasureKey, string[]> = {
    teorica: ['teorica', 'teórica', 'teo'],
    real: ['real'],
    retrabajo: ['retrabajo', 'ret'],
    manual: ['manual', 'man']
  };

  constructor(private options?: { measureAliases?: Partial<Record<ArkikMeasureKey, string[]>> }) {}

  async parseFile(file: File): Promise<{
    data: ArkikRawRow[];
    errors: ValidationError[];
    metadata: {
      plant: string;
      dateRange: { start: Date; end: Date };
      totalRows: number;
      validRows: number;
    };
  }> {
    const errors: ValidationError[] = [];
    const data: ArkikRawRow[] = [];

    const isCsv = /\.csv$/i.test(file.name) || (file.type && file.type.includes('csv'));
    let workbook: XLSX.WorkBook;
    if (isCsv) {
      const text = await file.text();
      workbook = XLSX.read(text, { type: 'string', raw: true, cellDates: false });
    } else {
      const arrayBuffer = await file.arrayBuffer();
      workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: false, // Don't let XLSX convert dates automatically (causes timezone issues)
        raw: true, // Get raw Excel values so we can handle dates properly
        dateNF: 'yyyy-mm-dd'
      });
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];

    const headerRowIndex = this.findHeaderRowIndex(rawData as any[][]);
    const header = (rawData[headerRowIndex] as any[]).map(v => String(v ?? '').trim());
    const preHeader = headerRowIndex > 0 ? (rawData[headerRowIndex - 1] as any[]).map(v => String(v ?? '').trim()) : [];
    const materialBlocks = this.detectMaterialBlocks(header, preHeader);
    const metadata = this.extractMetadata(rawData);

    const remisionIdx = header.findIndex(h => ArkikRawParser.STABLE_HEADERS.remision.test(h));
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i] as any[];
      if (!row || remisionIdx === -1 || !row[remisionIdx]) continue;
      try {
        const parsedRow = this.parseRow(row, i + 1, header, materialBlocks);
        const rowErrors = this.validateRow(parsedRow, i + 1);
        if (rowErrors.filter(e => !e.recoverable).length === 0) {
          data.push(parsedRow);
        }
        errors.push(...rowErrors);
      } catch (error: any) {
        errors.push({
          row_number: i + 1,
          error_type: ArkikErrorType.DATA_TYPE_ERROR,
          field_name: 'row',
          field_value: null,
          message: `Error parsing row: ${error.message}`,
          recoverable: false
        });
      }
    }

    return {
      data,
      errors,
      metadata: {
        ...metadata,
        totalRows: Math.max(0, rawData.length - (headerRowIndex + 1)),
        validRows: data.length
      }
    };
  }

  private parseRow(
    row: any[],
    rowNumber: number,
    header: string[],
    materialBlocks: MaterialColumnBlock[]
  ): ArkikRawRow {
    const getByHeader = (regex: RegExp): any => {
      const idx = header.findIndex(h => regex.test(h));
      return idx >= 0 ? row[idx] : undefined;
    };

    const materials: ArkikRawRow['materials'] = {};
    materialBlocks.forEach(block => {
      const teoricaValue = this.parseNumber(row[block.indicesByMeasure.teorica]) || 0;
      const realValue = this.parseNumber(row[block.indicesByMeasure.real]) || 0;
      const retrabajoValue = block.indicesByMeasure.retrabajo >= 0 ? 
        (this.parseNumber(row[block.indicesByMeasure.retrabajo]) || 0) : 0;
      const manualValue = block.indicesByMeasure.manual >= 0 ? 
        (this.parseNumber(row[block.indicesByMeasure.manual]) || 0) : 0;
      
      // Only add material if any measure has a non-zero value
      if (teoricaValue > 0 || realValue > 0 || retrabajoValue > 0 || manualValue > 0) {
        materials[block.arkikCode] = {
          teorica: teoricaValue,
          real: realValue,
          retrabajo: retrabajoValue,
          manual: manualValue
        } as Record<ArkikMeasureKey, number>;
      }
    });

    return {
      orden: String(getByHeader(ArkikRawParser.STABLE_HEADERS.orden) ?? '') || null,
      remision: this.normalizeRemision(String(getByHeader(ArkikRawParser.STABLE_HEADERS.remision) ?? '')),
      estatus: String(getByHeader(ArkikRawParser.STABLE_HEADERS.estatus) ?? ''),
      volumen: this.parseNumber(getByHeader(ArkikRawParser.STABLE_HEADERS.volumen)) || 0,
      cliente_codigo: String(getByHeader(ArkikRawParser.STABLE_HEADERS.cliente_codigo) ?? ''),
      cliente_nombre: String(getByHeader(ArkikRawParser.STABLE_HEADERS.cliente_nombre) ?? ''),
      rfc: String(getByHeader(ArkikRawParser.STABLE_HEADERS.rfc) ?? ''),
      obra: String(getByHeader(ArkikRawParser.STABLE_HEADERS.obra) ?? ''),
      punto_entrega: String(getByHeader(ArkikRawParser.STABLE_HEADERS.punto_entrega) ?? ''),
      prod_comercial: String(getByHeader(ArkikRawParser.STABLE_HEADERS.prod_comercial) ?? ''),
      prod_tecnico: String(getByHeader(ArkikRawParser.STABLE_HEADERS.prod_tecnico) ?? ''),
      product_description: String(getByHeader(ArkikRawParser.STABLE_HEADERS.product_description) ?? ''),
      comentarios_internos: String(getByHeader(ArkikRawParser.STABLE_HEADERS.comentarios_internos) ?? ''),
      comentarios_externos: String(getByHeader(ArkikRawParser.STABLE_HEADERS.comentarios_externos) ?? ''),
      elementos: String(getByHeader(ArkikRawParser.STABLE_HEADERS.elementos) ?? ''),
      camion: String(getByHeader(ArkikRawParser.STABLE_HEADERS.camion) ?? ''),
      placas: String(getByHeader(ArkikRawParser.STABLE_HEADERS.placas) ?? ''),
      chofer: String(getByHeader(ArkikRawParser.STABLE_HEADERS.chofer) ?? ''),
      bombeable: String(getByHeader(ArkikRawParser.STABLE_HEADERS.bombeable) ?? ''),
      fecha: this.parseDate(getByHeader(ArkikRawParser.STABLE_HEADERS.fecha)),
      hora_carga: this.parseDate(getByHeader(ArkikRawParser.STABLE_HEADERS.hora_carga)),
      materials
    };
  }

  private normalizeRemision(value: string): string {
    // Extract trailing numeric portion, e.g., P002-007789 -> 007789 -> 7789
    const m = value.match(/(\d{3,})\s*$/);
    const digits = m ? m[1] : value.replace(/\D+/g, '');
    if (digits) {
      // Normalize to integer to drop leading zeros
      const n = parseInt(digits, 10);
      if (!isNaN(n)) return String(n);
    }
    return digits || value;
  }

  private validateRow(row: ArkikRawRow, rowNumber: number): ValidationError[] {
    const errors: ValidationError[] = [];

    const requiredFields = [
      { field: 'remision', value: row.remision },
      { field: 'volumen', value: row.volumen },
      { field: 'cliente_nombre', value: row.cliente_nombre },
      { field: 'obra', value: row.obra },
      { field: 'fecha', value: row.fecha }
    ];

    requiredFields.forEach(({ field, value }) => {
      if (!value || value === '') {
        errors.push({
          row_number: rowNumber,
          error_type: ArkikErrorType.MISSING_REQUIRED_FIELD,
          field_name: field,
          field_value: value,
          message: `Campo requerido '${field}' está vacío`,
          recoverable: false
        });
      }
    });

    if (row.volumen <= 0) {
      errors.push({
        row_number: rowNumber,
        error_type: ArkikErrorType.INVALID_VOLUME,
        field_name: 'volumen',
        field_value: row.volumen,
        message: 'El volumen debe ser mayor a 0',
        recoverable: false
      });
    }

    // Product Description (Arkik long code) is the required product identity
    if (!row.product_description) {
      errors.push({
        row_number: rowNumber,
        error_type: ArkikErrorType.RECIPE_NOT_FOUND,
        field_name: 'product_description',
        field_value: row.product_description,
        message: 'Descripción de producto (Arkik) faltante',
        recoverable: true
      });
    }

    return errors;
  }

  private parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value;
    let s = String(value).trim();
    if (s.includes(',') && s.includes('.')) {
      s = s.replace(/,/g, '');
    } else if (s.includes(',') && !s.includes('.')) {
      s = s.replace(/\./g, '').replace(/,/g, '.');
    }
    const num = parseFloat(s);
    return isNaN(num) ? null : num;
  }

  private parseDate(value: any): Date {
    if (!value) return new Date();
    
    // Handle Excel serial dates (numbers representing days since 1900-01-01)
    if (typeof value === 'number') {

      
      // Excel stores dates as serial numbers starting from January 1, 1900
      // But Excel has a leap year bug: it treats 1900 as a leap year (which it wasn't)
      // So we need to account for this when converting
      
      const excelSerialDate = value;
      
      // COMPLETELY NEW APPROACH: Manual date calculation to avoid timezone issues
      // Excel serial dates are timezone-independent - let's calculate manually
      
      const wholeDays = Math.floor(excelSerialDate);
      const timeFraction = excelSerialDate - wholeDays;
      
      // Calculate time components from the fraction
      const totalSeconds = Math.round(timeFraction * 24 * 60 * 60);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      

      
      // Manual date calculation: Excel epoch is December 30, 1899
      // January 1, 1900 = day 1, so December 30, 1899 = day 0
      const baseYear = 1899;
      const baseMonth = 12; // December
      const baseDay = 30;
      
      // Calculate target date by adding wholeDays to base date
      // Use a simple date calculation to avoid timezone issues
      let targetYear = baseYear;
      let targetMonth = baseMonth;
      let targetDay = baseDay + wholeDays;
      
      // Handle month/year overflow manually 
      while (targetDay > getDaysInMonth(targetYear, targetMonth)) {
        targetDay -= getDaysInMonth(targetYear, targetMonth);
        targetMonth++;
        if (targetMonth > 12) {
          targetMonth = 1;
          targetYear++;
        }
      }
      

      
      // Create the final date object using the calculated components
      // This should be timezone-neutral since we're specifying exact components
      const localDate = new Date(targetYear, targetMonth - 1, targetDay, hours, minutes, seconds);
      

      
      return localDate;
    }
    
    // If it's already a Date object (shouldn't happen with our new config, but just in case)
    if (value instanceof Date) {
      const localDate = new Date(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        value.getHours(),
        value.getMinutes(),
        value.getSeconds(),
        value.getMilliseconds()
      );
      return localDate;
    }
    
    // Handle string dates
    if (typeof value === 'string') {
      try {
        // Try to parse as ISO string first
        if (value.includes('T') || value.includes('-')) {
          const parsed = new Date(value);
          if (!isNaN(parsed.getTime())) {
            // Extract components to avoid timezone conversion
            const localDate = new Date(
              parsed.getFullYear(),
              parsed.getMonth(),
              parsed.getDate(),
              parsed.getHours(),
              parsed.getMinutes(),
              parsed.getSeconds()
            );
            return localDate;
          }
        }
        
        // Try parsing the string as a number (could be Excel serial date as string)
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue > 0) {
          return this.parseDate(numValue); // Recursive call to handle as number
        }
        
      } catch (error) {
        // Silently fail and use fallback
      }
    }
    
    // Default fallback
    return new Date();
  }

  private findHeaderRowIndex(rawData: any[][]): number {
    const maxScan = Math.min(10, rawData.length);
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < maxScan; i++) {
      const cells = (rawData[i] || []).map(v => String(v ?? ''));
      const score = Object.values(ArkikRawParser.STABLE_HEADERS).reduce((acc, re) => acc + (cells.some(c => re.test(c)) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private detectMaterialBlocks(header: string[], preHeader?: string[]): MaterialColumnBlock[] {
    const blocks: MaterialColumnBlock[] = [];
    
    // Strategy: Look for material codes in preHeader and group with following measure columns
    if (!preHeader) {
      return blocks;
    }

    // Step 1: Find all potential material code positions
    const materialCandidates: { code: string; idx: number }[] = [];
    
    for (let i = 0; i < preHeader.length; i++) {
      const cell = String(preHeader[i] || '').trim();

      // Material code criteria: non-empty, not just dashes/spaces, reasonable length,
      // and allow letters/numbers with internal spaces or hyphens (e.g., "ARENA 1", "CEM-TIPO I")
      if (
        cell &&
        !/^[-\s]+$/.test(cell) &&
        cell.length >= 1 &&
        cell.length <= 10 &&
        /^[A-Z0-9][A-Z0-9\s-]*$/i.test(cell)
      ) {
        materialCandidates.push({ code: cell.toUpperCase(), idx: i });
      }
    }

    // Step 2: For each material candidate, scan forward to find measure columns
    for (let i = 0; i < materialCandidates.length; i++) {
      const { code, idx } = materialCandidates[i];
      const nextMaterialIdx = i + 1 < materialCandidates.length ? materialCandidates[i + 1].idx : header.length;
      
      let teoricaIdx = -1;
      let realIdx = -1;
      let retrabajoIdx = -1;
      let manualIdx = -1;
      
      // Search in the range between this material and the next one
      for (let col = idx; col < nextMaterialIdx && col < header.length; col++) {
        const measureCell = String(header[col] || '').trim().toLowerCase();
        
        if (measureCell) {
          // Match variations of "Teórica"
          if (measureCell.match(/te[oó]rica|teorica|teo/i)) {
            teoricaIdx = col;
          }
          
          // Match "Real"
          if (measureCell.match(/real/i)) {
            realIdx = col;
          }
          
          // Match "Retrabajo"
          if (measureCell.match(/retrabajo|ret/i)) {
            retrabajoIdx = col;
          }
          
          // Match "Manual"
          if (measureCell.match(/manual|man/i)) {
            manualIdx = col;
          }
        }
      }
      
      // Only create block if we found the basic required measures (teorica and real)
      if (teoricaIdx >= 0 && realIdx >= 0) {
        const block: MaterialColumnBlock = {
          arkikCode: code,
          indicesByMeasure: {
            teorica: teoricaIdx,
            real: realIdx,
            retrabajo: retrabajoIdx >= 0 ? retrabajoIdx : -1,
            manual: manualIdx >= 0 ? manualIdx : -1
          }
        };
        blocks.push(block);
      }
    }
    
    return blocks;
  }

  private extractMetadata(rawData: any[]): any {
    const plantRow = rawData[3] || [];
    const plantCode = plantRow[6] || 'Unknown';
    const plantName = plantRow[9] || 'Unknown';
    const startDate = this.parseDate(plantRow[37]);
    const endDate = this.parseDate(plantRow[43]);
    return {
      plant: `${plantCode} - ${plantName}`,
      dateRange: {
        start: startDate,
        end: endDate
      }
    };
  }
}


