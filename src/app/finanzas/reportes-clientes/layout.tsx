import React from 'react'
import { DM_Sans, JetBrains_Mono } from 'next/font/google'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-procurement',
})

const jetMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-jet-mono',
})

export default function ReportesClientesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${dmSans.className} ${jetMono.variable} min-h-screen bg-[#f5f3f0] text-stone-900 antialiased`}
    >
      {children}
    </div>
  )
}
