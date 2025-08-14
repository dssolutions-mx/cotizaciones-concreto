import * as XLSX from 'xlsx';
import { ArkikRawRow, ValidationError, ArkikErrorType, ArkikMeasureKey } from '@/types/arkik';

type MaterialColumnBlock = {
  arkikCode: string;
  indicesByMeasure: Record<ArkikMeasureKey, number>;
};

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
    real: ['real']
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
      workbook = XLSX.read(text, { type: 'string', raw: false });
    } else {
      const arrayBuffer = await file.arrayBuffer();
      workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: true,
        raw: false,
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
      materials[block.arkikCode] = {
        teorica: this.parseNumber(row[block.indicesByMeasure.teorica]) || 0,
        real: this.parseNumber(row[block.indicesByMeasure.real]) || 0
      } as Record<ArkikMeasureKey, number>;
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
    let digits = m ? m[1] : value.replace(/\D+/g, '');
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
    if (value instanceof Date) return value;
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return new Date();
      }
      return date;
    } catch {
      return new Date();
    }
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
    const aliases = { ...ArkikRawParser.DEFAULT_MEASURE_ALIASES, ...(this.options?.measureAliases || {}) };
    const measures: ArkikMeasureKey[] = ['teorica', 'real'];

    const measureRegex: Record<ArkikMeasureKey, RegExp> = {
      teorica: new RegExp(`(${aliases.teorica.join('|')})`, 'i'),
      real: new RegExp(`(${aliases.real.join('|')})`, 'i')
    } as const;

    const tokens = header.map((h, idx) => ({ h, idx }));
    type Candidate = { code: string; measure: ArkikMeasureKey; idx: number };
    const candidates: Candidate[] = [];
    tokens.forEach(({ h, idx }) => {
      const normalized = h.replace(/\s+/g, ' ').trim();
      (['teorica', 'real'] as ArkikMeasureKey[]).forEach(m => {
        if (measureRegex[m].test(normalized)) {
          let code = normalized.replace(measureRegex[m], '').trim().replace(/[-–]/g, '').trim().split(' ')[0];
          if (!code && preHeader && preHeader[idx]) {
            const ph = preHeader[idx].trim();
            if (ph && ph !== '-' && ph.length <= 6) {
              code = ph;
            }
          }
          if (code) candidates.push({ code: code.toUpperCase(), measure: m, idx });
        }
      });
    });

    const byCode = new Map<string, Candidate[]>();
    candidates.forEach(c => {
      if (!byCode.has(c.code)) byCode.set(c.code, []);
      byCode.get(c.code)!.push(c);
    });

    const blocks: MaterialColumnBlock[] = [];
    byCode.forEach((list, code) => {
      const idxByMeasure = {} as Record<ArkikMeasureKey, number>;
      let hasAll = true;
      (['teorica', 'real'] as ArkikMeasureKey[]).forEach(m => {
        const found = list.find(c => c.measure === m);
        if (!found) hasAll = false; else idxByMeasure[m] = found.idx;
      });
      if (hasAll) blocks.push({ arkikCode: code, indicesByMeasure: idxByMeasure });
    });

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


