'use client'

import React, { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { MEASURAND_INSTRUMENT_ROLES } from '@/lib/ema/uncertaintyMeasurand'
import { parseEquipoPool } from '@/lib/ema/uncertaintyStudyDesign'
import type { MeasurandCodigo, UncertaintyStudy } from '@/types/ema-uncertainty'

/**
 * Warning banner for FC / FC_CUBO / VIGAS studies when no press instrument with
 * the 'carga' role has a resolved calibration.
 *
 * Because each specimen is destroyed on testing, the press's load uncertainty
 * cannot be captured through Type A replicas — the calibration certificate is the
 * only source of u(Carga). A missing cert means the budget is not GUM-traceable
 * for the dominant contributor.
 */
export function EmaUncertaintyDestructiveBanner({
  study,
}: {
  study: UncertaintyStudy
}) {
  const measurand = study.measurand!
  const DESTRUCTIVE_CODES = ['FC', 'FC_CUBO', 'VIGAS'] as const
  const isDestructive = DESTRUCTIVE_CODES.includes(measurand.codigo as typeof DESTRUCTIVE_CODES[number])

  const [missing, setMissing] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!isDestructive) { setChecked(true); return }

    const pool = parseEquipoPool(study.equipo_pool_json)
    const rolesDef = MEASURAND_INSTRUMENT_ROLES[measurand.codigo as MeasurandCodigo]
    if (!rolesDef) { setChecked(true); return }

    // Find instruments assigned to 'carga' role
    const instrRoles = pool.instrumento_roles ?? {}
    const cargaInstrIds = Object.entries(instrRoles)
      .filter(([, rk]) => rk === 'carga')
      .map(([id]) => id)

    if (cargaInstrIds.length === 0) {
      // No explicit role assignment: fall back to checking any pool instrument
      if (pool.instrumento_ids.length === 0) {
        setMissing(true)
        setChecked(true)
        return
      }
      // With no role assignments, we can't isolate the press — skip banner
      setChecked(true)
      return
    }

    let cancelled = false
    async function check() {
      let anyWithCal = false
      for (const instrId of cargaInstrIds) {
        try {
          const res = await fetch(
            `/api/ema/instrumentos/${instrId}/certificados?limit=1&vigente=true`,
          )
          if (!res.ok) continue
          const json = await res.json()
          if ((json.data ?? []).length > 0) { anyWithCal = true; break }
        } catch { /* network error — skip */ }
      }
      if (!cancelled) {
        setMissing(!anyWithCal)
        setChecked(true)
      }
    }
    void check()
    return () => { cancelled = true }
  }, [isDestructive, study.equipo_pool_json, measurand.codigo])

  if (!isDestructive || !checked || !missing) return null

  return (
    <div className="mb-4 flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
      <div>
        <p className="font-medium">
          Prensa sin certificado de calibración vigente
        </p>
        <p className="mt-0.5 text-xs text-red-800/90">
          Para este tipo de ensayo destructivo, la incertidumbre de la carga (u(Carga)) no puede
          capturarse mediante réplicas — cada espécimen se destruye una sola vez. El certificado
          de calibración de la prensa es la <strong>única fuente de u_B(Carga)</strong>.
          Sin él, el presupuesto GUM estará incompleto y no será trazable (NMX-EC-17025 §7.6).
        </p>
        <p className="mt-1 text-xs text-red-800/90">
          Asigne la prensa en <strong>Configuración → Equipo del estudio</strong> y asegúrese de
          que tenga un certificado externo o una verificación interna con incertidumbre calculada.
        </p>
      </div>
    </div>
  )
}
