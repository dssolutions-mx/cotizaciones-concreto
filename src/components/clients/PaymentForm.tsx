import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client'; // Adjusted path
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PaymentFormProps {
  clientId: string;
  onSuccess?: () => void;
}

interface ConstructionSite {
  id: string;
  name: string;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ clientId, onSuccess }) => {
  const { profile, session } = useAuth(); // Get profile and session from useAuth
  const [formData, setFormData] = useState({
    amount: '',
    paymentMethod: 'Transferencia',
    referenceNumber: '',
    constructionSite: '',
    notes: ''
  });
  const [sites, setSites] = useState<ConstructionSite[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Verificar si el usuario tiene permisos para registrar pagos
  const canCreatePayments = profile?.role === 'PLANT_MANAGER' || profile?.role === 'EXECUTIVE';

  // Cargar obras del cliente
  useEffect(() => {
    const loadSites = async () => {
      setLoadingSites(true);
      const { data, error } = await supabase
        .from('construction_sites')
        .select('id, name')
        .eq('client_id', clientId)
        .eq('is_active', true);

      if (!error) {
        setSites(data || []);
      }
      setLoadingSites(false);
    };

    loadSites();
  }, [clientId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canCreatePayments) {
      alert('No tienes permisos para registrar pagos');
      return;
    }

    if (!formData.amount || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      alert('Por favor, ingresa un monto válido');
      return;
    }

    const userId = session?.user?.id; // Get user ID from session
    if (!userId) {
        alert('Error: No se pudo obtener el ID del usuario.');
        return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('client_payments')
        .insert({
          client_id: clientId,
          construction_site: formData.constructionSite || null,
          amount: parseFloat(formData.amount),
          payment_method: formData.paymentMethod,
          payment_date: new Date().toISOString(), // Add payment_date, assuming it's now
          reference_number: formData.referenceNumber || null,
          notes: formData.notes || null,
          created_by: userId // Use the fetched user ID
        });

      if (error) throw error;

      // Limpiar formulario
      setFormData({
        amount: '',
        paymentMethod: 'Transferencia',
        referenceNumber: '',
        constructionSite: '',
        notes: ''
      });

      if (onSuccess) onSuccess();

      alert('Pago registrado exitosamente');

    } catch (error: any) {
      console.error('Error registrando pago:', error);
      alert(`Error al registrar pago: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canCreatePayments) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <p className="text-center text-gray-600">
          No tienes permisos para registrar pagos. Contacta a un gerente o ejecutivo.
        </p>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Registrar Nuevo Pago</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Grid for better layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Monto*</Label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span>
                <Input
                  id="amount"
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  required
                  min="0.01"
                  step="0.01"
                  className="pl-7" // Adjusted padding for dollar sign
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Método de Pago*</Label>
              <Select 
                name="paymentMethod" 
                value={formData.paymentMethod}
                onValueChange={(value) => setFormData(prev => ({ ...prev, paymentMethod: value }))}
                required
              >
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="Seleccione un método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Grid for optional fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reference Number */}
            <div className="space-y-2">
              <Label htmlFor="referenceNumber">Número de Referencia</Label>
              <Input
                id="referenceNumber"
                type="text"
                name="referenceNumber"
                value={formData.referenceNumber}
                onChange={handleInputChange}
                placeholder="Opcional"
              />
            </div>

            {/* Construction Site */}
            <div className="space-y-2">
              <Label htmlFor="constructionSite">Obra Específica (Opcional)</Label>
              <Select 
                name="constructionSite"
                value={formData.constructionSite}
                onValueChange={(value) => setFormData(prev => ({ ...prev, constructionSite: value }))}
                disabled={loadingSites}
              >
                <SelectTrigger id="constructionSite">
                  <SelectValue placeholder={loadingSites ? "Cargando obras..." : "Todas las obras (General)"} />
                </SelectTrigger>
                <SelectContent>
                  {sites.map(site => (
                    <SelectItem key={site.id} value={site.name}>{site.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loadingSites && <p className="text-xs text-gray-500 pt-1">
                Si no se selecciona obra, el pago se aplicará al balance general.
              </p>}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              placeholder="Información adicional sobre el pago (opcional)"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={submitting || loadingSites}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? (
                <>
                  <span className="animate-spin h-4 w-4 mr-2 border-t-2 border-r-2 border-white rounded-full"></span>
                  Registrando...
                </>
              ) : (
                'Registrar Pago'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default PaymentForm; 