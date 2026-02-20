'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { RejectQuoteDialog } from './RejectQuoteDialog';
import type { PendingQuote } from '@/hooks/useApprovalTasks';

interface QuoteApprovalRowProps {
  quote: PendingQuote;
  onApprove: () => void;
  onReject: (reason: string) => void;
  isActing: boolean;
}

export function QuoteApprovalRow({ quote, onApprove, onReject, isActing }: QuoteApprovalRowProps) {
  const [rejectOpen, setRejectOpen] = useState(false);

  const handleRejectConfirm = (reason: string) => {
    onReject(reason);
    setRejectOpen(false);
  };

  return (
    <>
      <div className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/50 transition-colors gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-callout text-gray-900 truncate font-medium">{quote.client}</p>
            <Link
              href={`/quotes/${quote.id}`}
              className="shrink-0 text-muted-foreground hover:text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
          <p className="text-footnote text-muted-foreground">
            {quote.amount} • {quote.date} • {quote.constructionSite}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 h-8"
            onClick={() => setRejectOpen(true)}
            disabled={isActing}
          >
            <XCircle className="h-3.5 w-3.5 mr-1.5" />
            Rechazar
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 h-8"
            onClick={onApprove}
            disabled={isActing}
          >
            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
            Aprobar
          </Button>
        </div>
      </div>
      <RejectQuoteDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={handleRejectConfirm}
      />
    </>
  );
}
