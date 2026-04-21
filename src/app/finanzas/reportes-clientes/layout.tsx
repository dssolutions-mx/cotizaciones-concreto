import React from 'react'

export default function ReportesClientesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f3f0] text-stone-900 antialiased">
      {children}
    </div>
  )
}
