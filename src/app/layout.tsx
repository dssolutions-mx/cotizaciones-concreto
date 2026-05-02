import type { Metadata, Viewport } from 'next';
import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';
import './globals.css';
import RootLayoutClient from './RootLayoutClient';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const jetMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-jet-mono',
});

export const metadata: Metadata = {
  title: 'DC Concretos - Sistema de Manejo de Plantas',
  description: 'Sistema de manejo integral de plantas de concreto - DC Concretos',
  icons: {
    icon: '/images/dcconcretos/favicon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={cn(dmSans.className, jetMono.variable)}>
      <body className="min-h-screen bg-[#f5f3f0]" suppressHydrationWarning>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
