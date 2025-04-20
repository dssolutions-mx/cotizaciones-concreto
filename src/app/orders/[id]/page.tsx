import OrderDetailClient from '@/components/orders/OrderDetailClient'; // Corrected import path

interface OrderDetailPageProps {
  params: { id: string };
}

// Make the component async to properly handle params
export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = params; // Now correctly accessed in an async context
  
  // Pass the ID to the client component responsible for fetching and displaying details
  return <OrderDetailClient orderId={id} />;
} 