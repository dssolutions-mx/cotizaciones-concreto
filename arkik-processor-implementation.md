# Arkik Raw Excel Processor - Complete Implementation

## Plan Changes: Dynamic Materials By Plant

We will keep the existing order grouping algorithm, but make material parsing fully dynamic so it works across plants and as materials are added/removed. Key changes:

- Detect material columns from sheet headers instead of using fixed indices.
- Allow arbitrary material codes (not a fixed union) and map them per-plant using DB configuration.
- Support future materials by auto-detecting 4-column blocks per material: Teórica, Real, Retrabajo, Manual (case and accent insensitive; configurable aliases).
- Persist per-plant material code mapping in `arkik_material_mapping`; parser resolves Arkik header codes to internal material IDs via this mapping.
- Keep order grouping unchanged.

## 1. Type Definitions (`/types/arkik.ts`)

```typescript
// Arkik material codes are dynamic per plant
export type ArkikMaterialCode = string;

// Normalized measures present for each material
export type ArkikMeasureKey = 'teorica' | 'real' | 'retrabajo' | 'manual';

// Error types
export enum ArkikErrorType {
  CLIENT_NOT_FOUND = 'CLIENT_NOT_FOUND',
  CONSTRUCTION_SITE_NOT_FOUND = 'CONSTRUCTION_SITE_NOT_FOUND',
  RECIPE_NOT_FOUND = 'RECIPE_NOT_FOUND',
  RECIPE_NO_PRICE = 'RECIPE_NO_PRICE',
  MATERIAL_NOT_FOUND = 'MATERIAL_NOT_FOUND',
  DUPLICATE_REMISION = 'DUPLICATE_REMISION',
  INVALID_DATE = 'INVALID_DATE',
  INVALID_VOLUME = 'INVALID_VOLUME',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  DATA_TYPE_ERROR = 'DATA_TYPE_ERROR',
  PRODUCT_CODE_MISMATCH = 'PRODUCT_CODE_MISMATCH'
}

// Raw Excel row structure
export interface ArkikRawRow {
  orden: string | null;
  remision: string;
  estatus: string;
  volumen: number;
  cliente_codigo: string;
  cliente_nombre: string;
  rfc: string;
  obra: string;
  punto_entrega: string;
  prod_comercial: string;
  prod_tecnico: string;
  product_description: string;
  comentarios_internos: string;
  comentarios_externos: string;
  elementos: string;
  camion: string;
  placas: string;
  chofer: string;
  bombeable: string;
  fecha: Date;
  hora_carga: Date;
  materials: Record<ArkikMaterialCode, Record<ArkikMeasureKey, number>>;
}

// Staging remision with validation
export interface StagingRemision {
  id: string;
  session_id: string;
  row_number: number;
  
  // Raw data from Excel
  orden_original?: string;
  fecha: Date;
  hora_carga: Date;
  remision_number: string;
  estatus: string;
  volumen_fabricado: number;
  
  // Client & Site
  cliente_codigo: string;
  cliente_name: string;
  rfc: string;
  obra_name: string;
  punto_entrega: string;
  comentarios_externos: string;
  comentarios_internos: string;
  
  // Product/Recipe
  prod_comercial: string;
  prod_tecnico: string;
  product_description: string;
  recipe_code: string; // Derived from prod_tecnico
  
  // Transport
  camion: string;
  placas: string;
  conductor: string;
  bombeable: boolean;
  elementos: string;
  
  // Validated IDs
  client_id?: string;
  construction_site_id?: string;
  recipe_id?: string;
  truck_id?: string;
  driver_id?: string;
  
  // Order grouping
  suggested_order_group: string;
  suggested_order_id?: string;
  
  // Materials (all 4 types)
  materials_teorico: Record<string, number>;
  materials_real: Record<string, number>;
  materials_retrabajo: Record<string, number>;
  materials_manual: Record<string, number>;
  
  // Validation
  validation_status: 'pending' | 'valid' | 'warning' | 'error';
  validation_errors: ValidationError[];
}

// Validation error
export interface ValidationError {
  row_number: number;
  error_type: ArkikErrorType;
  field_name: string;
  field_value: any;
  message: string;
  suggestion?: any;
  recoverable: boolean;
}

// Order suggestion
export interface OrderSuggestion {
  group_key: string;
  client_id: string;
  construction_site_id?: string;
  obra_name: string;
  comentarios_externos: string[];
  date_range: {
    start: Date;
    end: Date;
  };
  remisiones: StagingRemision[];
  total_volume: number;
  suggested_name: string;
  recipe_codes: Set<string>;
  validation_issues: ValidationError[];
}

// Per-plant mapping from Arkik header codes to internal material IDs
export interface PlantMaterialMapping {
  plant_id: string;
  // e.g. 'A1' => 'uuid-of-AGUA-material'
  arkik_code_to_material_id: Record<string, string>;
}

// Optional per-plant aliases for the 4 measures
export interface PlantMeasureAliases {
  plant_id: string;
  // Regex fragments or exact labels per measure to match header cells
  aliases: {
    teorica: string[];   // e.g. ['teorica', 'teórica', 'teo']
    real: string[];      // e.g. ['real']
    retrabajo: string[]; // e.g. ['retrabajo', 're-trabajo']
    manual: string[];    // e.g. ['manual']
  };
}
```

## 2. Excel Parser for Raw Arkik Format (`/services/arkikRawParser.ts`)

```typescript
import * as XLSX from 'xlsx';
import { ArkikRawRow, ValidationError, ArkikErrorType, ArkikMeasureKey } from '@/types/arkik';

type MaterialColumnBlock = {
  arkikCode: string;           // e.g. 'A1'
  indicesByMeasure: Record<ArkikMeasureKey, number>; // column index for each measure
};

export class ArkikRawParser {
  // Stable non-material columns (indices may still differ by export version; use header matching if needed)
  private static readonly STABLE_HEADERS = {
    orden: /orden/i,
    remision: /remisi[oó]n/i,
    estatus: /estatus/i,
    volumen: /volumen/i,
    cliente_codigo: /cliente.*c[oó]digo/i,
    cliente_nombre: /cliente.*nombre/i,
    rfc: /rfc/i,
    obra: /obra/i,
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
    bombeable: /bombeable/i,
    fecha: /fecha/i,
    hora_carga: /hora.*carga/i
  } as const;

  // Measure aliases; can be overridden per-plant at runtime
  private static readonly DEFAULT_MEASURE_ALIASES: Record<ArkikMeasureKey, string[]> = {
    teorica: ['teorica', 'teórica', 'teo'],
    real: ['real'],
    retrabajo: ['retrabajo', 're-trabajo'],
    manual: ['manual']
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
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, {
        cellDates: true,
        raw: false,
        dateNF: 'yyyy-mm-dd'
      });
      
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Determine header row for labels (commonly row 7 or earlier; we scan first 10 rows)
      const headerRowIndex = this.findHeaderRowIndex(rawData as any[][]);
      const header = (rawData[headerRowIndex] as any[]).map(v => String(v ?? '').trim());

      // Discover material column blocks dynamically
      const materialBlocks = this.detectMaterialBlocks(header);
      
      // Extract metadata from header rows
      const metadata = this.extractMetadata(rawData);
      
      // Parse data starting from the first data row after header
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i] as any[];
        
        // Skip empty rows
        if (!row || !row[this.COLUMNS.remision]) continue;
        
        try {
          const parsedRow = this.parseRow(row, i + 1, header, materialBlocks);
          
          // Validate required fields
          const rowErrors = this.validateRow(parsedRow, i + 1);
          
          if (rowErrors.filter(e => !e.recoverable).length === 0) {
            data.push(parsedRow);
          }
          
          errors.push(...rowErrors);
        } catch (error) {
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
          totalRows: rawData.length - 7,
          validRows: data.length
        }
      };
      
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  private parseRow(
    row: any[],
    rowNumber: number,
    header: string[],
    materialBlocks: MaterialColumnBlock[]
  ): ArkikRawRow {
    // Resolve stable non-material columns by header matching
    const getByHeader = (regex: RegExp): any => {
      const idx = header.findIndex(h => regex.test(h));
      return idx >= 0 ? row[idx] : undefined;
    };

    // Parse materials dynamically
    const materials: ArkikRawRow['materials'] = {};
    materialBlocks.forEach(block => {
      materials[block.arkikCode] = {
        teorica: this.parseNumber(row[block.indicesByMeasure.teorica]) || 0,
        real: this.parseNumber(row[block.indicesByMeasure.real]) || 0,
        retrabajo: this.parseNumber(row[block.indicesByMeasure.retrabajo]) || 0,
        manual: this.parseNumber(row[block.indicesByMeasure.manual]) || 0
      };
    });

    return {
      orden: String(getByHeader(ArkikRawParser.STABLE_HEADERS.orden) ?? '') || null,
      remision: String(getByHeader(ArkikRawParser.STABLE_HEADERS.remision) ?? ''),
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

  private validateRow(row: ArkikRawRow, rowNumber: number): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Required fields
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
    
    // Validate volume
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
    
    // Check if recipe code can be derived from product code
    if (!row.prod_tecnico) {
      errors.push({
        row_number: rowNumber,
        error_type: ArkikErrorType.RECIPE_NOT_FOUND,
        field_name: 'prod_tecnico',
        field_value: row.prod_tecnico,
        message: 'Código de producto técnico faltante',
        recoverable: true
      });
    }
    
    return errors;
  }

  private parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(value);
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
    // Find the row which contains most of the stable headers
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

  private detectMaterialBlocks(header: string[]): MaterialColumnBlock[] {
    const aliases = { ...ArkikRawParser.DEFAULT_MEASURE_ALIASES, ...(this.options?.measureAliases || {}) };
    const measures: ArkikMeasureKey[] = ['teorica', 'real', 'retrabajo', 'manual'];

    // Build regex per measure
    const measureRegex: Record<ArkikMeasureKey, RegExp> = {
      teorica: new RegExp(`(${aliases.teorica.join('|')})`, 'i'),
      real: new RegExp(`(${aliases.real.join('|')})`, 'i'),
      retrabajo: new RegExp(`(${aliases.retrabajo.join('|')})`, 'i'),
      manual: new RegExp(`(${aliases.manual.join('|')})`, 'i')
    } as const;

    // Heuristic: Arkik labels often are like "A1 Teórica", "A1 Real", ... or in adjacent columns.
    // We scan headers and group by extracted material code token.
    const tokens = header.map((h, idx) => ({ h, idx }));
    // Extract candidate {code, measure} pairs
    type Candidate = { code: string; measure: ArkikMeasureKey; idx: number };
    const candidates: Candidate[] = [];
    tokens.forEach(({ h, idx }) => {
      const normalized = h.replace(/\s+/g, ' ').trim();
      const parts = normalized.split(' ');
      if (parts.length < 1) return;
      measures.forEach(m => {
        if (measureRegex[m].test(normalized)) {
          // remove measure term to get material code guess
          const code = normalized.replace(measureRegex[m], '').trim().replace(/[-–]/g, '').trim().split(' ')[0];
          if (code) candidates.push({ code: code.toUpperCase(), measure: m, idx });
        }
      });
    });

    // Group by material code and retain blocks with all 4 measures
    const byCode = new Map<string, Candidate[]>();
    candidates.forEach(c => {
      if (!byCode.has(c.code)) byCode.set(c.code, []);
      byCode.get(c.code)!.push(c);
    });

    const blocks: MaterialColumnBlock[] = [];
    byCode.forEach((list, code) => {
      const idxByMeasure = {} as Record<ArkikMeasureKey, number>;
      let hasAll = true;
      (['teorica', 'real', 'retrabajo', 'manual'] as ArkikMeasureKey[]).forEach(m => {
        const found = list.find(c => c.measure === m);
        if (!found) hasAll = false; else idxByMeasure[m] = found.idx;
      });
      if (hasAll) blocks.push({ arkikCode: code, indicesByMeasure: idxByMeasure });
    });

    return blocks;
  }

  private extractMetadata(rawData: any[]): any {
    // Extract plant info from row 4
    const plantRow = rawData[3] || [];
    const plantCode = plantRow[6] || 'Unknown';
    const plantName = plantRow[9] || 'Unknown';
    
    // Extract date range from row 4
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
```

## 3. Order Grouping Service (`/services/arkikOrderGrouper.ts`)

```typescript
import { StagingRemision, OrderSuggestion } from '@/types/arkik';

export class ArkikOrderGrouper {
  /**
   * Groups remisiones into suggested orders based on business rules
   */
  groupRemisiones(remisiones: StagingRemision[]): OrderSuggestion[] {
    const groups = new Map<string, StagingRemision[]>();
    
    // First, separate remisiones that already have orders
    const withOrder = remisiones.filter(r => r.orden_original);
    const withoutOrder = remisiones.filter(r => !r.orden_original);
    
    // Process remisiones with existing orders
    withOrder.forEach(remision => {
      const key = remision.orden_original!;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(remision);
    });
    
    // Group remisiones without orders
    withoutOrder.forEach(remision => {
      const key = this.generateGroupKey(remision);
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(remision);
    });
    
    // Convert groups to OrderSuggestions
    return Array.from(groups.entries()).map(([key, remisiones]) => 
      this.createOrderSuggestion(key, remisiones)
    );
  }

  /**
   * Generates grouping key based on business rules
   * Key format: CLIENT_SITE_DATE_COMENTARIO
   */
  private generateGroupKey(remision: StagingRemision): string {
    // Normalize components
    const client = remision.cliente_name.replace(/\s+/g, '_').toUpperCase();
    const site = remision.obra_name.replace(/\s+/g, '_').toUpperCase();
    const date = remision.fecha.toISOString().split('T')[0];
    
    // Use comentarios_externos as the primary differentiator
    // Extract the main element from comentarios (e.g., "COLUMNA 8.2" from "COLUMNA 8.2, VIADUCTO 4.3")
    const comentario = this.extractMainElement(remision.comentarios_externos);
    
    return `${client}_${site}_${date}_${comentario}`;
  }

  /**
   * Extracts the main construction element from comentarios_externos
   */
  private extractMainElement(comentarios: string): string {
    if (!comentarios) return 'GENERAL';
    
    // Common patterns in comentarios_externos:
    // "COLUMNA 8.2, VIADUCTO 4.3"
    // "ZAPATA DE MURO DE CONTENCIÓN ESTRIBO 13, V5, TAJO 1 LADO NTE"
    // "losa 107-108, V2"
    
    // Take the first part before the first comma
    const parts = comentarios.split(',');
    const mainPart = parts[0].trim().toUpperCase();
    
    // Normalize common terms
    const normalized = mainPart
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '');
    
    return normalized || 'GENERAL';
  }

  /**
   * Creates an OrderSuggestion from grouped remisiones
   */
  private createOrderSuggestion(
    groupKey: string, 
    remisiones: StagingRemision[]
  ): OrderSuggestion {
    // Sort remisiones by date
    remisiones.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    
    // Collect unique values
    const comentarios = new Set<string>();
    const recipeCodes = new Set<string>();
    const validationIssues: ValidationError[] = [];
    
    remisiones.forEach(r => {
      if (r.comentarios_externos) {
        comentarios.add(r.comentarios_externos);
      }
      if (r.recipe_code) {
        recipeCodes.add(r.recipe_code);
      }
      validationIssues.push(...r.validation_errors);
    });
    
    // Generate suggested name
    const suggestedName = this.generateOrderName(remisiones[0], comentarios);
    
    return {
      group_key: groupKey,
      client_id: remisiones[0].client_id || '',
      construction_site_id: remisiones[0].construction_site_id,
      obra_name: remisiones[0].obra_name,
      comentarios_externos: Array.from(comentarios),
      date_range: {
        start: remisiones[0].fecha,
        end: remisiones[remisiones.length - 1].fecha
      },
      remisiones,
      total_volume: remisiones.reduce((sum, r) => sum + r.volumen_fabricado, 0),
      suggested_name: suggestedName,
      recipe_codes: recipeCodes,
      validation_issues: validationIssues
    };
  }

  /**
   * Generates a human-readable order name
   */
  private generateOrderName(
    firstRemision: StagingRemision,
    comentarios: Set<string>
  ): string {
    const date = firstRemision.fecha.toISOString().split('T')[0];
    const obra = firstRemision.obra_name;
    
    // If single comentario, use it
    if (comentarios.size === 1) {
      const comment = Array.from(comentarios)[0];
      const element = comment.split(',')[0].trim();
      return `${obra} - ${element} - ${date}`;
    }
    
    // Multiple comentarios, use count
    return `${obra} - ${comentarios.size} elementos - ${date}`;
  }

  /**
   * Allows manual adjustment of groupings
   */
  mergeGroups(groups: OrderSuggestion[]): OrderSuggestion {
    if (groups.length === 0) {
      throw new Error('No groups to merge');
    }
    
    if (groups.length === 1) {
      return groups[0];
    }
    
    // Combine all remisiones
    const allRemisiones = groups.flatMap(g => g.remisiones);
    
    // Use the first group's client/site
    const baseGroup = groups[0];
    
    // Create merged group
    return this.createOrderSuggestion(
      `MERGED_${Date.now()}`,
      allRemisiones
    );
  }

  /**
   * Splits a group into multiple orders
   */
  splitGroup(
    group: OrderSuggestion,
    splitIndices: number[]
  ): OrderSuggestion[] {
    const results: OrderSuggestion[] = [];
    let startIdx = 0;
    
    // Sort split indices
    splitIndices.sort((a, b) => a - b);
    
    splitIndices.forEach(splitIdx => {
      if (splitIdx > startIdx && splitIdx < group.remisiones.length) {
        const subGroup = group.remisiones.slice(startIdx, splitIdx);
        results.push(this.createOrderSuggestion(
          `${group.group_key}_SPLIT_${startIdx}`,
          subGroup
        ));
        startIdx = splitIdx;
      }
    });
    
    // Add remaining remisiones
    if (startIdx < group.remisiones.length) {
      const subGroup = group.remisiones.slice(startIdx);
      results.push(this.createOrderSuggestion(
        `${group.group_key}_SPLIT_${startIdx}`,
        subGroup
      ));
    }
    
    return results;
  }
}
```

## 4. Main Processor Component (`/components/arkik/ArkikProcessor.tsx`)

```typescript
import React, { useState, useCallback } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { ArkikRawParser } from '@/services/arkikRawParser';
import { ArkikOrderGrouper } from '@/services/arkikOrderGrouper';
import { ArkikValidator } from '@/services/arkikValidator';
import { 
  StagingRemision, 
  OrderSuggestion, 
  ValidationError,
  ArkikErrorType 
} from '@/types/arkik';
import {
  Upload,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  FileSpreadsheet,
  TruckIcon,
  Users,
  Package
} from 'lucide-react';

export default function ArkikProcessor() {
  const { supabase } = useSupabase();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'validate' | 'group' | 'confirm'>('upload');
  
  // Processing state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stagingData, setStagingData] = useState<StagingRemision[]>([]);
  const [orderSuggestions, setOrderSuggestions] = useState<OrderSuggestion[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  
  // Statistics
  const [stats, setStats] = useState({
    totalRows: 0,
    validRows: 0,
    errorRows: 0,
    ordersToCreate: 0,
    remisionsWithoutOrder: 0,
    newClients: 0,
    newSites: 0,
    newTrucks: 0,
    newDrivers: 0
  });

  /**
   * Handle file upload and parsing
   */
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setLoading(true);
    
    try {
       // Parse Excel file
      const parser = new ArkikRawParser();
      const { data, errors, metadata } = await parser.parseFile(selectedFile);
      
      // Create import session
      const { data: session, error: sessionError } = await supabase
        .from('arkik_import_sessions')
        .insert({
          file_name: selectedFile.name,
          plant_id: 'YOUR_PLANT_ID', // Get from context
          status: 'validating',
          total_rows: metadata.totalRows,
          processed_rows: 0
        })
        .select()
        .single();
      
      if (sessionError) throw sessionError;
      
      setSessionId(session.id);
      
      // Convert raw data to staging format
      const stagingRows = data.map((row, index) => 
        convertToStagingRemision(row, session.id, index + 8)
      );
      
      setStagingData(stagingRows);
      setValidationErrors(errors);
      
      // Update stats
      setStats(prev => ({
        ...prev,
        totalRows: metadata.totalRows,
        validRows: data.length,
        errorRows: errors.filter(e => !e.recoverable).length,
        remisionsWithoutOrder: data.filter(r => !r.orden).length
      }));
      
      setStep('validate');
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error al procesar el archivo');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  /**
   * Validate data against database
   */
  const handleValidation = useCallback(async () => {
    setLoading(true);
    
    try {
      const validator = new ArkikValidator('YOUR_PLANT_ID');
      const { validated, errors } = await validator.validateBatch(stagingData);
      
      // Update staging data with validation results
      setStagingData(validated);
      setValidationErrors(prev => [...prev, ...errors]);
      
      // Count new entities to create
      const uniqueClients = new Set(
        validated.filter(r => !r.client_id).map(r => r.cliente_name)
      );
      const uniqueSites = new Set(
        validated.filter(r => !r.construction_site_id).map(r => r.obra_name)
      );
      const uniqueTrucks = new Set(validated.map(r => r.camion));
      const uniqueDrivers = new Set(validated.map(r => r.conductor));
      
      setStats(prev => ({
        ...prev,
        newClients: uniqueClients.size,
        newSites: uniqueSites.size,
        newTrucks: uniqueTrucks.size,
        newDrivers: uniqueDrivers.size
      }));
      
      // Save to staging table
      await saveToStaging(validated);
      
      setStep('group');
    } catch (error) {
      console.error('Validation error:', error);
      alert('Error durante la validación');
    } finally {
      setLoading(false);
    }
  }, [stagingData]);

  /**
   * Group remisiones into suggested orders
   */
  const handleGrouping = useCallback(() => {
    const grouper = new ArkikOrderGrouper();
    const suggestions = grouper.groupRemisiones(stagingData);
    
    setOrderSuggestions(suggestions);
    setStats(prev => ({
      ...prev,
      ordersToCreate: suggestions.filter(s => !s.remisiones[0].orden_original).length
    }));
    
    setStep('confirm');
  }, [stagingData]);

  /**
   * Final confirmation and processing
   */
  const handleConfirmation = useCallback(async () => {
    setLoading(true);
    
    try {
      // Create orders for groups without existing orders
      for (const suggestion of orderSuggestions) {
        if (!suggestion.remisiones[0].orden_original) {
          await createOrder(suggestion);
        }
      }
      
      // Process all remisiones
      await processRemisiones(stagingData);
      
      // Update session status
      await supabase
        .from('arkik_import_sessions')
        .update({
          status: 'completed',
          processed_rows: stagingData.length,
          successful_rows: stagingData.filter(r => r.validation_status === 'valid').length,
          completed_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      alert('Procesamiento completado exitosamente');
      
      // Reset state
      resetState();
      
    } catch (error) {
      console.error('Error in confirmation:', error);
      alert('Error al procesar los datos');
    } finally {
      setLoading(false);
    }
  }, [orderSuggestions, stagingData, sessionId]);

  // Helper functions...
  const convertToStagingRemision = (
    row: ArkikRawRow,
    sessionId: string,
    rowNumber: number
  ): StagingRemision => {
    // Extract recipe code from prod_tecnico
    const recipeCode = row.prod_tecnico; // This might need transformation
    
    // Convert materials to separate objects
    const materials_teorico: Record<string, number> = {};
    const materials_real: Record<string, number> = {};
    const materials_retrabajo: Record<string, number> = {};
    const materials_manual: Record<string, number> = {};
    
    Object.entries(row.materials).forEach(([code, values]) => {
      if (values) {
        materials_teorico[code] = values.teorica;
        materials_real[code] = values.real;
        materials_retrabajo[code] = values.retrabajo;
        materials_manual[code] = values.manual;
      }
    });
    
    return {
      id: crypto.randomUUID(),
      session_id: sessionId,
      row_number: rowNumber,
      orden_original: row.orden,
      fecha: row.fecha,
      hora_carga: row.hora_carga,
      remision_number: row.remision,
      estatus: row.estatus,
      volumen_fabricado: row.volumen,
      cliente_codigo: row.cliente_codigo,
      cliente_name: row.cliente_nombre,
      rfc: row.rfc,
      obra_name: row.obra,
      punto_entrega: row.punto_entrega,
      comentarios_externos: row.comentarios_externos,
      comentarios_internos: row.comentarios_internos,
      prod_comercial: row.prod_comercial,
      prod_tecnico: row.prod_tecnico,
      product_description: row.product_description,
      recipe_code: recipeCode,
      camion: row.camion,
      placas: row.placas,
      conductor: row.chofer,
      bombeable: row.bombeable === 'Bombeable',
      elementos: row.elementos,
      suggested_order_group: '',
      materials_teorico,
      materials_real,
      materials_retrabajo,
      materials_manual,
      validation_status: 'pending',
      validation_errors: []
    };
  };

  // UI Components
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Procesador de Reportes Arkik
        </h1>
        <p className="mt-2 text-gray-600">
          Importa y procesa reportes de producción desde Arkik
        </p>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          {['upload', 'validate', 'group', 'confirm'].map((s, idx) => (
            <div
              key={s}
              className={`flex items-center ${
                step === s ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <div className={`
                rounded-full h-10 w-10 flex items-center justify-center
                ${step === s ? 'bg-blue-100' : 'bg-gray-100'}
              `}>
                {idx + 1}
              </div>
              <span className="ml-2 capitalize">{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      {step === 'upload' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12">
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <FileSpreadsheet className="h-12 w-12 text-gray-400" />
              <span className="mt-2 text-sm text-gray-600">
                Click para seleccionar archivo Excel de Arkik
              </span>
            </label>
          </div>
        </div>
      )}

      {step === 'validate' && (
        <ValidationResults
          stats={stats}
          errors={validationErrors}
          onContinue={handleValidation}
          loading={loading}
        />
      )}

      {step === 'group' && (
        <GroupingResults
          suggestions={orderSuggestions}
          stats={stats}
          onContinue={handleGrouping}
          loading={loading}
        />
      )}

      {step === 'confirm' && (
        <ConfirmationView
          suggestions={orderSuggestions}
          stats={stats}
          errors={validationErrors}
          onConfirm={handleConfirmation}
          onCancel={() => setStep('group')}
          loading={loading}
        />
      )}
    </div>
  );
}
```

## 5. Error Recovery Strategies

```typescript
// Error recovery service
export class ArkikErrorRecovery {
  /**
   * Attempts to recover from validation errors
   */
  async attemptRecovery(
    errors: ValidationError[],
    stagingData: StagingRemision[]
  ): Promise<{
    recovered: number;
    unrecoverable: ValidationError[];
  }> {
    let recovered = 0;
    const unrecoverable: ValidationError[] = [];
    
    for (const error of errors) {
      switch (error.error_type) {
        case ArkikErrorType.CLIENT_NOT_FOUND:
          // Try fuzzy matching or create new client
          if (error.suggestion && error.suggestion.length > 0) {
            // Auto-select best match if similarity > 0.8
            const bestMatch = error.suggestion[0];
            if (bestMatch.similarity > 0.8) {
              // Update staging data with matched client
              recovered++;
            } else {
              unrecoverable.push(error);
            }
          } else {
            // Queue for new client creation
            unrecoverable.push(error);
          }
          break;
          
        case ArkikErrorType.CONSTRUCTION_SITE_NOT_FOUND:
          // Suggest creating new site
          unrecoverable.push({
            ...error,
            suggestion: {
              action: 'create_site',
              client_id: error.suggestion?.client_id
            }
          });
          break;
          
        case ArkikErrorType.RECIPE_NO_PRICE:
          // Flag for price setup
          unrecoverable.push({
            ...error,
            suggestion: {
              action: 'setup_price',
              recipe_id: error.suggestion?.recipe_id
            }
          });
          break;
          
        case ArkikErrorType.DUPLICATE_REMISION:
          // Skip or update existing
          unrecoverable.push({
            ...error,
            suggestion: {
              action: 'skip_or_update'
            }
          });
          break;
          
        default:
          unrecoverable.push(error);
      }
    }
    
    return { recovered, unrecoverable };
  }
}
```

## 6. Material Mapping Configuration

```sql
-- Per-plant, dynamic mapping from Arkik header code to internal material id
-- Schema suggestion:
-- CREATE TABLE IF NOT EXISTS arkik_material_mapping (
--   plant_id uuid NOT NULL REFERENCES plants(id),
--   arkik_code text NOT NULL,
--   material_id uuid NOT NULL REFERENCES materials(id),
--   PRIMARY KEY (plant_id, arkik_code)
-- );

-- Example upsert for a given plant
INSERT INTO arkik_material_mapping (plant_id, arkik_code, material_id)
SELECT
  :plant_id,
  codes.arkik_code,
  m.id
FROM (
  VALUES
    ('A1', 'AGUA'),
    ('C1', 'CEMENTO'),
    ('AR2', 'ARENA_2'),
    ('G10', 'GRAVA_10MM')
) AS codes(arkik_code, material_name)
JOIN materials m ON m.material_name = codes.material_name AND m.plant_id = :plant_id
ON CONFLICT (plant_id, arkik_code) DO UPDATE SET material_id = EXCLUDED.material_id;
```

## Summary

This implementation provides:

1. **Complete Raw File Support**: Detects headers dynamically; no fixed indices
2. **Smart Order Grouping**: Uses client + site + date + comentarios_externos (unchanged)
3. **Comprehensive Validation**: Checks clients, sites, recipes, materials, duplicates
4. **Error Recovery**: Fuzzy matching, suggestions, and manual intervention options
5. **Transport Tracking**: Manages trucks and drivers
6. **Material Mapping**: Dynamic per-plant mapping; supports new materials seamlessly
7. **Audit Trail**: Complete session tracking and error logging

The system can handle remisiones without orders and intelligently group them based on the comentarios_externos field as the primary differentiator, while accommodating plant-specific and evolving material sets.

## Implementation Impact Analysis

- Types (`/types/arkik.ts`):
  - Replace fixed `ARKIK_MATERIALS` array with dynamic `ArkikMaterialCode = string` and `ArkikMeasureKey`.
  - Update `ArkikRawRow.materials` to `Record<string, Record<ArkikMeasureKey, number>>`.
  - Add optional per-plant measure alias config types.

- Parser (`/services/arkikRawParser.ts`):
  - Remove `COLUMNS.materials` fixed positions; implement header scanning and `detectMaterialBlocks`.
  - Resolve non-material column positions via regex header matching.
  - Start data rows after detected header row, not hardcoded index 7.
  - Accept optional per-plant measure aliases.

- Validator (`/services/arkikValidator.ts`):
  - When validating materials, use `arkik_material_mapping` to translate `arkikCode` to `material_id` per plant.
  - Flag unmapped materials with `ArkikErrorType.MATERIAL_NOT_FOUND` and suggestion to add mapping.

- UI (`/components/arkik/ArkikProcessor.tsx`):
  - No changes to grouping logic. Ensure plant context is supplied to parser/validator for mapping.

- DB (`arkik_material_mapping`):
  - Ensure table exists; migrate data per plant. Use upserts to keep mappings current.
