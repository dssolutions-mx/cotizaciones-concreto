import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Editar Cliente',
  description: 'Editar información del cliente',
};

export default function EditClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 