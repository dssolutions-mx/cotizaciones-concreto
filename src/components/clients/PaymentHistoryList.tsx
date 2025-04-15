import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client'; // Adjusted path based on previous fix
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PaymentHistoryListProps {
  clientId: string;
  constructionSite?: string;
  limit?: number;
}

// Define a basic type for the payment data
interface ClientPayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  construction_site: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

const PaymentHistoryList: React.FC<PaymentHistoryListProps> = ({ 
  clientId, 
  constructionSite, 
  limit = 10 
}) => {
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPayments = async () => {
      setLoading(true);

      let query = supabase
        .from('client_payments')
        .select(`
          id,
          amount,
          payment_date,
          payment_method,
          reference_number,
          construction_site,
          notes,
          created_by,
          created_at
        `)
        .eq('client_id', clientId)
        .order('payment_date', { ascending: false })
        .limit(limit);

      // Filtrar por obra específica si se proporciona
      if (constructionSite) {
        query = query.eq('construction_site', constructionSite);
      }

      const { data, error } = await query;

      if (!error) {
        setPayments((data as ClientPayment[]) || []);
      }

      setLoading(false);
    };

    loadPayments();
  }, [clientId, constructionSite, limit]);

  return (
    <Card className="w-full mt-4">
      <CardHeader>
        <CardTitle>Historial de Pagos {constructionSite ? `(${constructionSite})` : '(General)'}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin h-6 w-6 border-2 border-gray-500 rounded-full border-t-transparent"></div>
          </div>
        ) : (
          <Table>
            {payments.length === 0 && (
              <TableCaption>No hay pagos registrados {constructionSite ? `para la obra ${constructionSite}` : 'para este cliente'}.</TableCaption>
            )}
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Fecha</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Referencia</TableHead>
                {!constructionSite && (
                  <TableHead>Obra</TableHead>
                )}
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">
                    {new Date(payment.payment_date).toLocaleDateString('es-MX')}
                  </TableCell>
                  <TableCell>{payment.payment_method}</TableCell>
                  <TableCell>{payment.reference_number || '-'}</TableCell>
                  {!constructionSite && (
                    <TableCell>
                      {payment.construction_site ? (
                        <Badge variant="secondary">{payment.construction_site}</Badge>
                      ) : (
                        <Badge variant="outline">General</Badge>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-right font-semibold">
                    ${payment.amount.toLocaleString('es-MX', {minimumFractionDigits: 2})}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default PaymentHistoryList; 