-- Update capping input descripcion and norma_ref for FC_CUBO measurand.
-- The capping systematic contributor is often misread as a physical thickness;
-- clarify it is the kg/cm² bias from non-parallelism of the capping plane.

UPDATE ema_uncertainty_measurand_inputs
SET
  descripcion = 'Aporte sistemático del cabeceo (capping) por no-paralelismo del plano de carga. '
                'Expresado directamente en kg/cm² — no es el espesor del capping sino la contribución '
                'a la incertidumbre del resultado de resistencia (NMX-C-109 §6 / ASTM C617).',
  norma_ref   = 'NMX-C-109 §6; ASTM C617'
WHERE
  simbolo = 'capping'
  AND measurand_id = (
    SELECT id FROM ema_uncertainty_measurands WHERE codigo = 'FC_CUBO'
  );
