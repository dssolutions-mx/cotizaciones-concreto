'use client';

import React, { useState } from 'react';
import CreditStatusSummary from './CreditStatusSummary';
import CreditTermsCard from './CreditTermsCard';
import DocumentManager from './DocumentManager';
import PaymentComplianceView from './PaymentComplianceView';
import QuickSetupModal from './QuickSetupModal';
import { CreditStatus, ClientCreditTerms, PaymentComplianceInfo } from '@/lib/supabase/creditTerms';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FileText, History } from 'lucide-react';

interface CreditManagementViewProps {
  clientId: string;
  clientName: string;
  creditStatus: CreditStatus;
  creditTerms: ClientCreditTerms | null;
  paymentCompliance: PaymentComplianceInfo;
  canEditTerms: boolean;
  canVerifyDocuments: boolean;
  userRole: string;
}

export default function CreditManagementView({
  clientId,
  clientName,
  creditStatus,
  creditTerms,
  paymentCompliance,
  canEditTerms,
  canVerifyDocuments,
  userRole,
}: CreditManagementViewProps) {
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSetupSuccess = () => {
    setRefreshKey(prev => prev + 1);
    // Reload the page to get fresh data
    window.location.reload();
  };

  const handleConfigureClick = () => {
    setIsSetupModalOpen(true);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Hero Section: Credit Status Summary */}
        <CreditStatusSummary
          creditStatus={creditStatus}
          onConfigureClick={handleConfigureClick}
          canEdit={canEditTerms}
        />

        {/* Collapsible Sections - Only show if credit is configured */}
        {creditStatus.has_terms && (
          <Accordion type="multiple" defaultValue={['terms', 'documents']} className="space-y-4">
            {/* Terms & Conditions */}
            <AccordionItem value="terms" className="border rounded-lg bg-white shadow-sm">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-base">Términos y Condiciones</h3>
                    <p className="text-sm text-gray-500">Límites, frecuencia de pago y configuración</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <CreditTermsCard
                  clientId={clientId}
                  clientName={clientName}
                  creditTerms={creditTerms}
                  isEditable={canEditTerms}
                  onDelete={handleSetupSuccess}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Documents */}
            <AccordionItem value="documents" className="border rounded-lg bg-white shadow-sm">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-base">Documentos</h3>
                    <p className="text-sm text-gray-500">Pagarés, contratos y documentación</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <DocumentManager
                  clientId={clientId}
                  clientName={clientName}
                  canUpload={canEditTerms || userRole === 'SALES_AGENT'}
                  canVerify={canVerifyDocuments}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Payment Compliance */}
            <AccordionItem value="compliance" className="border rounded-lg bg-white shadow-sm">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <History className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-base">Historial de Pagos</h3>
                    <p className="text-sm text-gray-500">Cumplimiento y registros de pago</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <PaymentComplianceView complianceInfo={paymentCompliance} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>

      {/* Quick Setup Modal */}
      <QuickSetupModal
        open={isSetupModalOpen}
        onOpenChange={setIsSetupModalOpen}
        clientId={clientId}
        clientName={clientName}
        onSuccess={handleSetupSuccess}
      />
    </>
  );
}
