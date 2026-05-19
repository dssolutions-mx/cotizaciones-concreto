import { redirect } from 'next/navigation'
import { getMeasurandByCodigo } from '@/services/emaUncertaintyService'
import { NewStudyForm } from './NewStudyForm'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'

export const dynamic = 'force-dynamic'

export default async function NuevoEstudioPage({
  params,
}: {
  params: Promise<{ measurandCode: string }>
}) {
  const { measurandCode } = await params
  const measurand = await getMeasurandByCodigo(measurandCode)
  if (!measurand) redirect('/quality/ema/incertidumbre')

  // When the user lands on the FC (cylinder) page, also load FC_CUBO so the
  // form can offer a geometry selector without a second round-trip.
  const cuboMeasurand =
    measurand.codigo === 'FC' ? await getMeasurandByCodigo('FC_CUBO') : null

  return (
    <>
      <EmaBreadcrumb
        items={[
          { label: 'Incertidumbre', href: '/quality/ema/incertidumbre' },
          { label: measurand.nombre, href: `/quality/ema/incertidumbre/${measurand.codigo}/estudios` },
          { label: 'Nuevo estudio' },
        ]}
      />

      <div className="mx-auto mt-4 w-full max-w-4xl space-y-4">
        <header className="rounded-lg border border-stone-200 bg-white px-4 py-4 md:px-5">
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">
            Nuevo estudio de incertidumbre
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {measurand.nombre} · {measurand.metodo_norma}
          </p>
        </header>
        <NewStudyForm measurand={measurand} cuboVariant={cuboMeasurand ?? undefined} />
      </div>
    </>
  )
}
