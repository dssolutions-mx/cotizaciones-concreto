import type {
    EnsayosData,
    MuestrasData,
    MuestreosData,
    RemisionesData,
    RecipeVersionsData,
    RemisionMaterialesData
} from '@/types/quality';
import { addDays, isSameDay, parseISO } from 'date-fns'; // Import date-fns functions

export interface CalculatedMetrics {
    numeroEnsayos: number;
    ensayosEnCumplimiento: number;
    resistenciaPromedio: number | null;
    desviacionEstandar: number | null;
    porcentajeResistenciaGarantia: number | null;
    coeficienteVariacion: number | null;
    // Add advanced metrics later if needed
    // eficiencia: number | null;
    // rendimientoVolumetrico: number | null;
    eficienciaPromedio: number | null;
    rendimientoVolumetricoPromedio: number | null;
}

interface RawDataBundle {
    ensayos: EnsayosData[];
    muestras: MuestrasData[];
    muestreos: MuestreosData[];
    remisiones: RemisionesData[];
    recipeVersions: RecipeVersionsData[];
    remisionMateriales: RemisionMaterialesData[];
}

// Internal type to hold ensayo with linked muestra data
interface EnsayoWithMuestra extends EnsayosData {
    muestra?: MuestrasData; // Optional linked muestra
}

/**
 * Calculates the standard deviation of a list of numbers.
 * @param values - Array of numbers.
 * @param mean - The pre-calculated mean of the numbers.
 * @returns Standard deviation, or null if not calculable.
 */
function calculateStdDev(values: number[], mean: number): number | null {
    if (values.length < 2) {
        return null; // Cannot calculate std dev with less than 2 values
    }
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
}

/**
 * Calculates advanced metrics (efficiency, yield) for EACH muestreo.
 * @param rawData 
 * @returns An object containing arrays of calculated efficiencies and yields.
 */
function calculateIndividualAdvancedMetrics(rawData: RawDataBundle): { efficiencies: number[], yields: number[] } {
    console.log('[MetricsCalculator] Calculating individual advanced metrics...');
    const { muestreos, remisiones, remisionMateriales, recipeVersions, muestras, ensayos } = rawData;

    // Create lookup maps
    const remisionesMap = new Map(remisiones.map(r => [r.id, r]));
    const recipeVersionsMap = new Map(recipeVersions.map(rv => [rv.recipe_id, rv]));
    const materialesMap = new Map<string, RemisionMaterialesData[]>();
    remisionMateriales.forEach(rm => {
        if (!materialesMap.has(rm.remision_id)) {
            materialesMap.set(rm.remision_id, []);
        }
        materialesMap.get(rm.remision_id)!.push(rm);
    });
    // Map Muestras by their ID for quick lookup when linking Ensayos
    const muestrasByIdMap = new Map(muestras.map(m => [m.id, m])); 

    // Group Ensayos by Muestreo ID, including linked Muestra data
    const ensayosByMuestreoMap = new Map<string, EnsayoWithMuestra[]>();
    ensayos.forEach(e => {
        const muestra = muestrasByIdMap.get(e.muestra_id); // Find linked muestra
        if (muestra) {
            if (!ensayosByMuestreoMap.has(muestra.muestreo_id)) {
                ensayosByMuestreoMap.set(muestra.muestreo_id, []);
            }
            // Store Ensayo along with its linked Muestra
            ensayosByMuestreoMap.get(muestra.muestreo_id)!.push({ ...e, muestra: muestra }); 
        }
    });

    const calculatedEfficiencies: number[] = [];
    const calculatedYields: number[] = [];

    muestreos.forEach(muestreo => {
        const remision = remisionesMap.get(muestreo.remision_id);
        if (!remision) return; 

        const materiales = materialesMap.get(remision.id) || [];
        const recipeVersion = recipeVersionsMap.get(remision.recipe_id);
        // Get the enriched ensayos for this muestreo
        const relatedEnsayosWithMuestra = ensayosByMuestreoMap.get(muestreo.id) || []; 

        // --- Calculate Rendimiento Volumetrico --- 
        const masaUnitaria = muestreo.masa_unitaria;
        const volumenRegistrado = remision.volumen_fabricado;
        const sumaMateriales = materiales.reduce((sum, mat) => sum + (mat.cantidad_real || 0), 0);
        
        let rendimientoVolumetrico: number | null = null;
        if (masaUnitaria && masaUnitaria > 0 && volumenRegistrado && volumenRegistrado > 0 && sumaMateriales > 0) {
            const volumenReal = sumaMateriales / masaUnitaria;
            rendimientoVolumetrico = (volumenReal / volumenRegistrado) * 100;
            if (!isNaN(rendimientoVolumetrico)) { // Check for NaN
               calculatedYields.push(rendimientoVolumetrico);
            }
        }

        // --- Calculate Eficiencia --- 
        const kgCemento = materiales.find(m => m.material_type === 'cement')?.cantidad_real || 0;
        const clasificacion = recipeVersion?.notes?.toUpperCase().includes('MR') ? 'MR' : 'FC';
        const ageDays = recipeVersion?.age_days;
        
        let eficiencia: number | null = null;
        if (kgCemento > 0 && ageDays !== null && ageDays !== undefined) {
            let avgResistenciaGarantia: number | null = null;
            try {
                 const fechaMuestreo = parseISO(muestreo.fecha_muestreo); 
                 const fechaGarantia = addDays(fechaMuestreo, ageDays);

                 // Filter the enriched ensayos
                 const ensayosGarantia = relatedEnsayosWithMuestra.filter(e => 
                    e.muestra?.fecha_programada_ensayo && 
                    isSameDay(parseISO(e.muestra.fecha_programada_ensayo), fechaGarantia) &&
                    e.resistencia_calculada !== null
                 );
                 
                 if (ensayosGarantia.length > 0) {
                     const sumResistencia = ensayosGarantia.reduce((sum, eg) => sum + eg.resistencia_calculada!, 0);
                     avgResistenciaGarantia = sumResistencia / ensayosGarantia.length;
                 }
            } catch (dateError) {
                console.error(`[MetricsCalculator] Error processing dates for muestreo ${muestreo.id}:`, dateError);
            }

            if (avgResistenciaGarantia !== null && !isNaN(avgResistenciaGarantia)) {
                 let consumoCementoReal = 0; // Calculate consumption for MR case
                 if (masaUnitaria && masaUnitaria > 0 && sumaMateriales > 0) {
                    const volumenReal = sumaMateriales / masaUnitaria;
                    if (volumenReal > 0) {
                        consumoCementoReal = kgCemento / volumenReal;
                    }
                 }

                 if (clasificacion === 'MR') {
                     if (consumoCementoReal > 0) {
                         eficiencia = (avgResistenciaGarantia / 0.13) / consumoCementoReal; 
                     }
                 } else { // FC case
                      eficiencia = avgResistenciaGarantia / kgCemento;
                 }

                 if (eficiencia !== null && !isNaN(eficiencia)) {
                    calculatedEfficiencies.push(eficiencia);
                 } 
            }
        }
    });

    console.log(`[MetricsCalculator] Calculated ${calculatedEfficiencies.length} efficiencies and ${calculatedYields.length} yields.`);
    return { efficiencies: calculatedEfficiencies, yields: calculatedYields };
}

/**
 * Calculates basic and advanced quality metrics from raw data.
 * @param rawData - The fetched raw data bundle.
 * @returns CalculatedMetrics object.
 */
export function calculateAllMetrics(rawData: RawDataBundle): CalculatedMetrics {
    console.log('[MetricsCalculator] Starting all metric calculations...');
    const { ensayos } = rawData;

    // --- Basic Metrics Calculation (Directly from Ensayos) --- 
    const validEnsayos = ensayos.filter(e => e.resistencia_calculada !== null);
    const resistencias = validEnsayos.map(e => e.resistencia_calculada as number);
    const cumplimientos = ensayos
        .filter(e => e.porcentaje_cumplimiento !== null)
        .map(e => e.porcentaje_cumplimiento as number);

    const numeroEnsayos = ensayos.length;
    const ensayosEnCumplimiento = ensayos.filter(e => e.porcentaje_cumplimiento !== null && e.porcentaje_cumplimiento >= 100).length;

    let resistenciaPromedio: number | null = null;
    let desviacionEstandar: number | null = null;
    let porcentajeResistenciaGarantia: number | null = null;
    let coeficienteVariacion: number | null = null;

    if (resistencias.length > 0) {
        resistenciaPromedio = resistencias.reduce((sum, val) => sum + val, 0) / resistencias.length;
        if (resistencias.length > 1) {
             desviacionEstandar = calculateStdDev(resistencias, resistenciaPromedio!);
        }
    }
    if (cumplimientos.length > 0) {
        porcentajeResistenciaGarantia = cumplimientos.reduce((sum, val) => sum + val, 0) / cumplimientos.length;
    }
    if (desviacionEstandar !== null && resistenciaPromedio !== null && resistenciaPromedio !== 0) {
        coeficienteVariacion = (desviacionEstandar / resistenciaPromedio) * 100;
    }

    // --- Advanced Metrics Calculation (Averaged across Muestreos) --- 
    const { efficiencies, yields } = calculateIndividualAdvancedMetrics(rawData);
    
    const eficienciaPromedio = efficiencies.length > 0 
        ? efficiencies.reduce((sum, val) => sum + val, 0) / efficiencies.length 
        : null;
        
    const rendimientoVolumetricoPromedio = yields.length > 0
        ? yields.reduce((sum, val) => sum + val, 0) / yields.length
        : null;

    // --- Combine Metrics --- 
    const metrics: CalculatedMetrics = {
        numeroEnsayos,
        ensayosEnCumplimiento,
        resistenciaPromedio,
        desviacionEstandar,
        porcentajeResistenciaGarantia,
        coeficienteVariacion,
        eficienciaPromedio,
        rendimientoVolumetricoPromedio
    };

    console.log('[MetricsCalculator] Calculated all metrics:', metrics);
    return metrics;
}

// Future function for more complex metrics
/*
export function calculateAdvancedMetrics(rawData: RawDataBundle): Partial<CalculatedMetrics> {
    // TODO: Implement logic based on `calcular_metricas_muestreo` SQL function
    // This involves linking ensayos back to muestreos, remisiones, materials etc.
    // Requires careful handling of data joining and calculations like:
    // - Volumen real (suma materiales / masa unitaria)
    // - Rendimiento volumétrico (volumen real / volumen registrado)
    // - Consumo cemento real (kg cemento / volumen real)
    // - Eficiencia (resistencia / consumo cemento real - with adjustments for MR/FC)
    console.warn('[MetricsCalculator] Advanced metrics calculation not yet implemented.');
    return {
        // eficiencia: null,
        // rendimientoVolumetrico: null,
    };
}
*/ 