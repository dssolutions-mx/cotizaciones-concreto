import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getStudy, listPublishedU } from '@/services/emaUncertaintyService'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { StudyWorkspaceClient } from './StudyWorkspaceClient'

export const dynamic = 'force-dynamic'

export default async function StudyDetailPage({
  params,
}: {
  params: Promise<{ measurandCode: string; id: string }>
}) {
  const { measurandCode, id } = await params
  const study = await getStudy(id)
  if (!study) redirect('/quality/ema/incertidumbre')

  const measurandName = study.measurand?.nombre ?? measurandCode
  const published =
    (await listPublishedU()).find((p) => p.measurand_id === study.measurand_id) ?? null

  return (
    <>
      <EmaBreadcrumb
        items={[
          { label: 'Incertidumbre', href: '/quality/ema/incertidumbre' },
          {
            label: measurandName,
            href: `/quality/ema/incertidumbre/${measurandCode}/estudios`,
          },
          { label: `Estudio ${study.fecha_estudio}` },
        ]}
      />

      <Suspense
        fallback={
          <div className="mt-4 text-sm text-stone-500">Cargando espacio de trabajo…</div>
        }
      >
        <StudyWorkspaceClient
          study={study}
          publishedForMeasurand={published}
          measurandCode={measurandCode}
        />
      </Suspense>
    </>
  )
}
