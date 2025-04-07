import OrderDetailClient from '@/components/orders/OrderDetailClient';

interface OrderDetailPageProps {
  params: { id: string };
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = params;
  
  return <OrderDetailClient orderId={id} />;
} 