/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import * as XLSX from 'xlsx';
import { saveRecipeReferenceMaterials } from './recipeReferenceMaterials';
import { recipeService } from '../supabase/recipes';
import { ExcelRecipeData } from '@/types/recipes';

// Define a proper row type instead of any[]
type ExcelRow = Array<string | number | undefined | null>;

// Interfaz para los datos de receta
interface RecipeData {
  recipeCode: string;
  recipeType: 'FC' | 'MR'; // Indicar si es tipo FC o MR
  characteristics: {
    strength: number;
    age: number;
    placement: string;
    maxAggregateSize: number;
    slump: number;
  };
  materials: {
    cement: number;
    water: number;
    gravel: number;         // Grava total o grava 20mm para FC
    gravel40mm?: number;    // Grava 40mm solo para MR (opcional)
    volcanicSand: number;
    basalticSand: number;
    additive1: number;
    additive2: number;
  };
  // Datos informativos adicionales sobre materiales en SSS
  referenceData: {
    sssWater?: number;
  };
}

/**
 * Procesa un archivo Excel y extrae los datos de recetas de todas las hojas
 * Detecta automáticamente si las hojas son de tipo FC o MR
 */
export const processExcelData = async (file: File): Promise<ExcelRecipeData[]> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, {
    cellStyles: true,
    cellDates: true,
    cellNF: true
  });
  const recipes: ExcelRecipeData[] = [];

  // Procesar cada hoja del libro
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    
    // Determinar el tipo de receta basado en el nombre de la hoja o contenido
    const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as ExcelRow[];
    const sheetType = detectSheetType(sheetName, sheetData);
    
    if (sheetType === 'FC') {
      const fcRecipes = processSheet(worksheet, 'FC');
      recipes.push(...fcRecipes);
    } else if (sheetType === 'MR') {
      const mrRecipes = processSheet(worksheet, 'MR');
      recipes.push(...mrRecipes);
    }
    // Si no es FC ni MR, se omite la hoja
  }

  return recipes;
};

/**
 * Detecta el tipo de hoja basado en su nombre y contenido
 */
function detectSheetType(sheetName: string, sheetData: Array<ExcelRow>): 'FC' | 'MR' | null {
  // Verificar por nombre de hoja
  if (sheetName.toLowerCase().includes('fc')) return 'FC';
  if (sheetName.toLowerCase().includes('mr')) return 'MR';
  
  // Verificar por contenido (primeras 10 filas)
  for (let i = 0; i < Math.min(10, sheetData.length); i++) {
    const row = sheetData[i] || [];
    const rowStr = row.join(' ').toLowerCase();
    
    if (rowStr.includes('fc') || rowStr.includes('f\'c') || rowStr.includes('compresión')) {
      return 'FC';
    }
    if (rowStr.includes('mr') || rowStr.includes('módulo de ruptura')) {
      return 'MR';
    }
  }
  
  return null;
}

/**
 * Procesa una hoja de Excel, extrayendo los datos de recetas
 * @param worksheet La hoja de Excel a procesar
 * @param recipeType El tipo de receta ('FC' o 'MR')
 */
function processSheet(worksheet: XLSX.WorkSheet, recipeType: 'FC' | 'MR'): ExcelRecipeData[] {
  // Convertir a array comenzando desde la fila 11
  const rows = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    range: 10 // Índice 10 corresponde a la fila 11
  }) as ExcelRow[];

  const recipes: ExcelRecipeData[] = [];

  // Procesar cada fila
  for (const row of rows) {
    if (!row || row.length === 0) continue;

    // Verificar que la fila tenga datos válidos (código de receta)
    if (!row[11]) continue; // Columna L para el código

    // Crear la receta según el tipo (FC o MR)
    if (recipeType === 'FC') {
      const recipe = createFCRecipe(row);
      if (validateRecipe(recipe)) {
        recipes.push(recipe);
      }
    } else if (recipeType === 'MR') {
      const recipe = createMRRecipe(row);
      if (validateRecipe(recipe)) {
        recipes.push(recipe);
      }
    }
  }

  return recipes;
}

/**
 * Crea un objeto de receta tipo FC a partir de una fila
 */
function createFCRecipe(row: ExcelRow): ExcelRecipeData {
  return {
    recipeCode: String(row[11]), // Columna L
    recipeType: 'FC',
    characteristics: {
      strength: Number(row[12]), // Columna M
      age: Number(row[13]),     // Columna N
      placement: String(row[14]),   // Columna O
      maxAggregateSize: Number(row[15]), // Columna P
      slump: Number(row[16])    // Columna Q
    },
    materials: {
      cement: parseFloat(String(row[45] || 0)),       // Columna AT - cemento
      water: parseFloat(String(row[46] || 0)),        // Columna AU - agua
      gravel: parseFloat(String(row[47] || 0)),       // Columna AV - grava
      volcanicSand: parseFloat(String(row[48] || 0)), // Columna AW - arena volcánica
      basalticSand: parseFloat(String(row[49] || 0)), // Columna AX - arena basáltica
      additive1: parseFloat(String(row[53] || 0)),    // Columna BB - aditivo 1
      additive2: parseFloat(String(row[54] || 0))     // Columna BC - aditivo 2
    },
    referenceData: {
      sssWater: parseFloat(String(row[19] || 0))  // Column T for water SSS in FC
    }
  };
}

/**
 * Crea un objeto de receta tipo MR a partir de una fila
 */
function createMRRecipe(row: ExcelRow): ExcelRecipeData {
  return {
    recipeCode: String(row[11]), // Columna L
    recipeType: 'MR',
    characteristics: {
      strength: parseFloat(String(row[12] || 0)),     // Columna M - MR en kg/cm²
      age: parseInt(String(row[13] || 0)),            // Columna N - edad en días
      placement: String(row[14] || ''),       // Columna O - tipo de colocación (D/B)
      maxAggregateSize: parseFloat(String(row[15] || 0)), // Columna P - TMA en mm
      slump: parseFloat(String(row[16] || 0))         // Columna Q - revenimiento en cm
    },
    materials: {
      // Mapeo según las columnas específicas para MR
      cement: parseFloat(String(row[48] || 0)),        // Columna AW - CEMENTO
      water: parseFloat(String(row[49] || 0)),         // Columna AX - AGUA
      gravel: parseFloat(String(row[50] || 0)),        // Columna AY - GRAVA 20MM
      gravel40mm: parseFloat(String(row[51] || 0)),    // Columna AZ - GRAVA 40MM
      volcanicSand: parseFloat(String(row[52] || 0)),  // Columna BA - ARENA VOLCANICA
      basalticSand: parseFloat(String(row[53] || 0)),  // Columna BB - ARENA BASALTICA
      additive1: parseFloat(String(row[58] || 0)),     // Columna BG - ADITIVO LINEA
      additive2: parseFloat(String(row[59] || 0))      // Columna BH - ADITIVO 2
    },
    referenceData: {
      sssWater: parseFloat(String(row[19] || 0))  // Column T for water SSS in MR
    }
  };
}

/**
 * Valida que una receta tenga todos los valores numéricos necesarios
 */
function validateRecipe(recipe: ExcelRecipeData): boolean {
  const basicValidation = (
    !isNaN(recipe.characteristics.strength) &&
    !isNaN(recipe.characteristics.age) &&
    !isNaN(recipe.characteristics.maxAggregateSize) &&
    !isNaN(recipe.characteristics.slump) &&
    !isNaN(recipe.materials.cement) &&
    !isNaN(recipe.materials.water) &&
    !isNaN(recipe.materials.gravel) &&
    !isNaN(recipe.materials.volcanicSand) &&
    !isNaN(recipe.materials.basalticSand)
  );

  // Para recetas MR, también validamos la grava 40mm
  if (recipe.recipeType === 'MR') {
    return basicValidation && !isNaN(recipe.materials.gravel40mm || 0);
  }

  return basicValidation;
} 