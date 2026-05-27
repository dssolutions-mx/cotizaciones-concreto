import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Plus } from 'lucide-react'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { Button } from '@/components/ui/button'
import { EmaUncertaintyStudyEstadoBadge } from '@/components/ema/uncertainty/EmaUncertaintyStudyEstadoBadge'
import { getMeasurandByCodigo, listStudies } from '@/services/emaUncertaintyService'

export const dynamic = 'force-dynamic'

export default async function EstudiosListPage({
  params,
}: {
  params: Promise<{ measurandCode: string }>
}) {
  const { measurandCode } = await params
  const measurand = await getMeasurandByCodigo(measurandCode)
  if (!measurand) redirect('/quality/ema/incertidumbre')

  const studies = await listStudies(measurand.id)

  return (
    <>
      <EmaBreadcrumb
        items={[
          { label: 'Incertidumbre', href: '/quality/ema/incertidumbre' },
          { label: measurand.nombre },
          { label: 'Estudios' },
        ]}
      />

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 items-start gap-3 rounded-lg border border-stone-200 bg-white p-4 md:p-5">
          <Link
            href="/quality/ema/incertidumbre"
            className="mt-0.5 rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            aria-label="Volver a incertidumbre"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              Estudios — {measurand.nombre}
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">{measurand.metodo_norma}</p>
          </div>
        </div>
        <Button asChild className="bg-stone-900 hover:bg-stone-800 shrink-0">
          <Link href={`/quality/ema/incertidumbre/${measurandCode}/estudios/nuevo`}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo estudio
          </Link>
        </Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-right">Réplicas</th>
              <th className="px-4 py-3 text-left">Documento</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {studies.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-400 italic">
                  No hay estudios registrados.
                </td>
              </tr>
            ) : (
              studies.map((s) => (
                <tr key={s.id} className="hover:bg-stone-50/80">
                  <td className="px-4 py-3 font-medium text-stone-800">{s.fecha_estudio}</td>
                  <td className="px-4 py-3">
                    <EmaUncertaintyStudyEstadoBadge estado={s.estado} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-stone-600">{s.n_replicas}</td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">
                    {s.documento_codigo ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <Link
                      href={`/quality/ema/incertidumbre/${measurandCode}/estudios/${s.id}`}
                      className="text-sky-800 hover:underline text-xs font-medium"
                    >
                      Abrir
                    </Link>
                    {s.estado === 'publicado' && (
                      <Link
                        href={`/quality/ema/incertidumbre/${measurandCode}/estudios/${s.id}/imprimir`}
                        className="text-stone-600 hover:underline text-xs font-medium"
                      >
                        PDF
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
