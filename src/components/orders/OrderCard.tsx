import React from "react";
import { Order } from "../../types/order";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface OrderCardProps {
  order: Order;
  onClick: () => void;
}

const getStatusColor = (status: string): { bg: string; text: string; icon: React.ReactNode } => {
  switch (status?.toLowerCase()) {
    case "created":
      return { 
        bg: "bg-yellow-100", 
        text: "text-yellow-800",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          </svg>
        )
      };
    case "validated":
      return { 
        bg: "bg-green-100", 
        text: "text-green-800",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )
      };
    case "scheduled":
      return { 
        bg: "bg-purple-100", 
        text: "text-purple-800",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
        )
      };
    case "completed":
      return { 
        bg: "bg-blue-100", 
        text: "text-blue-800",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )
      };
    case "cancelled":
      return { 
        bg: "bg-red-100", 
        text: "text-red-800",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )
      };
    default:
      return { 
        bg: "bg-gray-100", 
        text: "text-gray-800",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        )
      };
  }
};

const formatDate = (dateString: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return format(date, "dd MMM yyyy", { locale: es });
};

const formatTime = (timeString: string) => {
  if (!timeString) return "";
  return format(parseISO(`2000-01-01T${timeString}`), 'HH:mm');
};

// Helper to safely get client name
const getClientName = (order: Order): string => {
  // @ts-ignore - handle potential clients property if it exists in the runtime object
  if (order.clients?.business_name) {
    // @ts-ignore
    return order.clients.business_name;
  }
  
  // @ts-ignore - handle potential client_name property
  if (order.client_name) {
    // @ts-ignore 
    return order.client_name;
  }
  
  return order.client_id || "Cliente sin ID";
};

export const OrderCard: React.FC<OrderCardProps> = ({ order, onClick }) => {
  const { bg, text, icon } = getStatusColor(order.order_status);
  const clientName = getClientName(order);
  
  return (
    <Card 
      onClick={onClick} 
      className="cursor-pointer hover:bg-gray-50 transition-colors duration-200 border-l-4 hover:shadow-md"
      style={{ borderLeftColor: bg.includes('yellow') ? '#fbbf24' : 
                              bg.includes('green') ? '#10b981' : 
                              bg.includes('purple') ? '#8b5cf6' : 
                              bg.includes('blue') ? '#3b82f6' : 
                              bg.includes('red') ? '#ef4444' : '#9ca3af' }}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <h3 className="font-medium text-gray-900">
              {clientName}
            </h3>
            <span className="text-sm text-gray-500 mt-1 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              {order.construction_site || "Obra sin nombre"}
            </span>
          </div>
          <Badge className={`${bg} ${text} border-0 px-2 py-1 flex items-center`}>
            {icon}
            <span className="capitalize">{order.order_status || "Sin estado"}</span>
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="flex items-center">
            <div className="rounded-full bg-gray-100 p-1.5 mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Entrega</p>
              <p className="font-medium text-sm">
                {order.delivery_date ? (
                  <>
                    {formatDate(order.delivery_date)}
                    <span className="text-gray-500"> · </span>
                    {formatTime(order.delivery_time)}
                  </>
                ) : "Sin fecha"}
              </p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="rounded-full bg-gray-100 p-1.5 mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="font-medium text-sm">{formatCurrency(order.total_amount || 0)}</p>
            </div>
          </div>
        </div>
        
        {order.credit_status && (
          <div className="mt-3 flex items-center">
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
              order.credit_status === 'approved' ? 'bg-green-500' :
              order.credit_status === 'rejected' ? 'bg-red-500' :
              'bg-yellow-500'
            }`}></span>
            <span className="text-xs text-gray-600 capitalize">
              Crédito: {order.credit_status}
            </span>
          </div>
        )}
        
        {order.special_requirements && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-500 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Notas
            </p>
            <p className="text-xs text-gray-700 line-clamp-2 mt-1">{order.special_requirements}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 