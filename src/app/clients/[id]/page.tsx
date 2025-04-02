import ClientDetailContent from './ClientDetailContent';

export default async function ClientDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = params.id;
  return <ClientDetailContent clientId={id} />;
} 