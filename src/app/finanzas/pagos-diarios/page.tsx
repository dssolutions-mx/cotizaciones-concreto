import { redirect } from 'next/navigation';

export default function PagosDiariosRedirectPage() {
  redirect('/finanzas/ventas-diarias?tab=pagos');
}
