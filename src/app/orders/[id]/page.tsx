import OrderDetailClient from '@/components/orders/OrderDetailClient';

// Define the proper type for dynamic route params
interface OrderDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Ensure component is async and properly awaits params
export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  // Properly await the params object before accessing its properties
  const resolvedParams = await params;
  const { id } = resolvedParams;
  
  // Pass the ID to the client component responsible for fetching and displaying details
  return <OrderDetailClient orderId={id} />;
} 