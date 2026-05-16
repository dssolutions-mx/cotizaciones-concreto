import { NextResponse } from 'next/server'

// POST /api/ap/sat-status-check — stub for future SAT ConsultaCFDIService integration
export async function POST() {
  return NextResponse.json(
    { error: 'No implementado — requiere integración PAC/SAT (SOAP ConsultaCFDIService)' },
    { status: 501 },
  )
}
