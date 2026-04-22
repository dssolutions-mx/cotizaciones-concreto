-- Backfill materials.accounting_code from ERP product list
-- Source: Productos - Todos los Productos_20260421.csv (clave contable = accounting_code)
-- Matching is semantic (not exact name match). Same ERP code applies to all plants when the catalog
-- has the same logical material per material_code / name pattern.
--
-- Sin fila dedicada en catálogo (revisar manual / alta futura): 05AD280, 03AB01YM, 06FS01, 06MF01, 07DS01, 07UR01, PENETRON
-- C1 «Cemento C1» genérico (sin «CPC 40» en nombre) no se tocó; cementos C2/C3/C-4 y C1 RS sí.
-- A52 «Inclusor de aire» no recibe 05ADA52 (solo filas «Aditivo A52»).

-- ─── Cemento CPC 40 (gris a granel ERP) ───
UPDATE materials
SET accounting_code = '01CECPC40R', updated_at = now()
WHERE is_active
  AND (
    material_code IN ('C2', 'C3', 'C-4')
    OR (material_code = 'C1' AND material_name ILIKE '%CPC%40%')
  );

-- ─── Gravas basalto (granulometría ≈ 3/8, 3/4, 1½) ───
UPDATE materials
SET accounting_code = '02GB10', updated_at = now()
WHERE is_active AND material_code IN ('G10', 'GB1');

UPDATE materials
SET accounting_code = '02GB20', updated_at = now()
WHERE is_active AND material_code IN ('G20', 'GB2');

UPDATE materials
SET accounting_code = '02GB40', updated_at = now()
WHERE is_active AND material_code IN ('G40', 'GB4');

-- ─── Kryton ───
UPDATE materials
SET accounting_code = '02KRYSTOL', updated_at = now()
WHERE is_active AND material_code = 'KRYTON';

-- ─── Arenas (misma clave ERP en todas las plantas donde exista el material) ───
UPDATE materials
SET accounting_code = '03AB01', updated_at = now()
WHERE is_active AND material_code = 'ARY';

-- 03AB01YM (ARENA BLANCA YM): no hay material distinto de ARY en catálogo; asignar manualmente si crean material o mapeo distinto.

UPDATE materials
SET accounting_code = '03ALTI', updated_at = now()
WHERE is_active AND material_code = 'ARL';

UPDATE materials
SET accounting_code = '03ASTI', updated_at = now()
WHERE is_active AND material_code = 'AR2';

UPDATE materials
SET accounting_code = '03AT05', updated_at = now()
WHERE is_active AND material_code = 'ART1';

-- Volcánica ERP distinta de «arena blanca»: solo fila ARV1 (ARY queda 03AB01 arena blanca / volcánica operativa).
UPDATE materials
SET accounting_code = '03AV01', updated_at = now()
WHERE is_active AND material_code = 'ARV1';

-- ─── Agua (pozo: nombres distintos en catálogo) ───
UPDATE materials
SET accounting_code = '04AGUA', updated_at = now()
WHERE is_active AND material_code = 'A1' AND trim(material_name) = 'Agua Potable';

UPDATE materials
SET accounting_code = '04AGUAJ', updated_at = now()
WHERE is_active
  AND material_code = 'A1'
  AND trim(material_name) IN ('Agua A1', 'Agua');

-- ─── Aditivos / línea (solo filas que existen en catálogo) ───
UPDATE materials
SET accounting_code = '05AD510', updated_at = now()
WHERE is_active AND material_code = '510MX';

UPDATE materials
SET accounting_code = '05AD800', updated_at = now()
WHERE is_active AND material_code = '800 MX';

UPDATE materials
SET accounting_code = '05ADA28', updated_at = now()
WHERE is_active AND material_code = 'A28';

UPDATE materials
SET accounting_code = '05ADA52', updated_at = now()
WHERE is_active AND material_code = 'A52' AND material_name ILIKE '%Aditivo A52%';

UPDATE materials
SET accounting_code = '05ADA55', updated_at = now()
WHERE is_active AND material_code = 'A55';

UPDATE materials
SET accounting_code = '05ADA92', updated_at = now()
WHERE is_active AND material_code = 'A92' AND material_name ILIKE '%Aditivo A92%';

UPDATE materials
SET accounting_code = '05ADD18', updated_at = now()
WHERE is_active AND material_code = 'D18';

UPDATE materials
SET accounting_code = '05ADIMPER', updated_at = now()
WHERE is_active AND material_code = 'IMP01';

UPDATE materials
SET accounting_code = '05ADM12', updated_at = now()
WHERE is_active AND material_code = 'M12';

UPDATE materials
SET accounting_code = '05ADMEP', updated_at = now()
WHERE is_active AND material_code = 'MRC';

UPDATE materials
SET accounting_code = '05ADPF', updated_at = now()
WHERE is_active AND material_code = 'AE2';

UPDATE materials
SET accounting_code = '05ADR22', updated_at = now()
WHERE is_active AND material_code = 'R22';

UPDATE materials
SET accounting_code = '05ADSR351', updated_at = now()
WHERE is_active AND material_code = 'SR351';

UPDATE materials
SET accounting_code = '05DYNAMOND', updated_at = now()
WHERE is_active AND material_code = 'SR53';

-- ─── Fibra PP ───
UPDATE materials
SET accounting_code = '06FP01', updated_at = now()
WHERE is_active AND material_code = '00R' AND material_name ILIKE '%polipropileno%';

-- ─── SkLite / Sika ───
UPDATE materials
SET accounting_code = '08SIKA', updated_at = now()
WHERE is_active AND material_code = 'SKLITE';
