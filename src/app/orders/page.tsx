'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import RoleGuard from '@/components/auth/RoleGuard';
import OrdersList from '@/components/orders/OrdersList';
import CreditValidationTab from '@/components/orders/CreditValidationTab';
import ScheduleOrderForm from '@/components/orders/ScheduleOrderForm';

// Separate component to use searchParams
function OrdersContent() {
  const { hasRole } = useAuth();
  const searchParams = useSearchParams();
  
  // Get quote data from URL parameters when component mounts
  const [selectedQuoteData] = useState({
    quoteId: searchParams.get('quoteId') || '',
    clientId: searchParams.get('clientId') || '',
    totalAmount: Number(searchParams.get('totalAmount')) || 0
  });

  // Show different sections based on role and navigation
  const [showOrdersList, setShowOrdersList] = useState(false);
  const [showCreditValidation, setShowCreditValidation] = useState(false);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Administración de Órdenes</h1>
      </div>

      <div className="mb-6 border-b">
        <nav className="flex -mb-px space-x-8">
          <button
            onClick={() => {
              setShowOrdersList(false);
              setShowCreditValidation(false);
            }}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              !showOrdersList && !showCreditValidation
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Crear Orden
          </button>
          
          <button
            onClick={() => {
              setShowOrdersList(true);
              setShowCreditValidation(false);
            }}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              showOrdersList
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Lista de Órdenes
          </button>
          
          {hasRole(['EXECUTIVE', 'PLANT_MANAGER']) && (
            <button
              onClick={() => {
                setShowOrdersList(false);
                setShowCreditValidation(true);
              }}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                showCreditValidation
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Validación de Crédito
            </button>
          )}
        </nav>
      </div>

      <div>
        {showOrdersList ? (
          <OrdersList />
        ) : showCreditValidation ? (
          <RoleGuard allowedRoles={['EXECUTIVE', 'PLANT_MANAGER']} fallback={null}>
            <CreditValidationTab />
          </RoleGuard>
        ) : (
          <RoleGuard allowedRoles={['SALES_AGENT', 'EXECUTIVE']} fallback={null}>
            <ScheduleOrderForm 
              preSelectedQuoteId={selectedQuoteData.quoteId}
              preSelectedClientId={selectedQuoteData.clientId}
              onOrderCreated={() => setShowOrdersList(true)}
            />
          </RoleGuard>
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrdersContent />
    </Suspense>
  );
} 