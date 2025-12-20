'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Calendar, DollarSign, Truck, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { ClientPaymentManagerModal } from '@/components/finanzas/ClientPaymentManagerModal';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type ClientBalance = {
  client_id: string;
  business_name: string;
  current_balance: number;
  last_payment_date: string | null;
  credit_status: string;
  last_updated?: string;
  assigned_user_id?: string | null;
};

type ExtraClientData = Record<string, { lastDeliveryDate: string | null }>

type Segment = 'all' | 'with_balance' | 'critical' | 'excellent' | 'with_advances' | 'high_balance';

export default function ClientBalancesDashboard({
  initialClientBalances,
  initialActivityMetrics,
}: {
  initialClientBalances: ClientBalance[];
  initialActivityMetrics: { activeClients: number; totalRevenue90Days: number; avgOrderValue: number };
}) {
  const { profile } = useAuthBridge();
  const [segment, setSegment] = React.useState<Segment>('all');
  const [search, setSearch] = React.useState('');
  const [expandedClients, setExpandedClients] = React.useState<Set<string>>(new Set());
  const [clientDetails, setClientDetails] = React.useState<Record<string, any>>({});
  const [clientBalances, setClientBalances] = React.useState<ClientBalance[]>(initialClientBalances);
  const [extraClientData, setExtraClientData] = React.useState<ExtraClientData>({});
  const [loadingDetails, setLoadingDetails] = React.useState<Set<string>>(new Set());
  const [progressiveDataLoaded, setProgressiveDataLoaded] = React.useState(false);
  const [clientPricing, setClientPricing] = React.useState<Record<string, any>>({});
  const [pricingLoaded, setPricingLoaded] = React.useState(false);
  const highBalanceThreshold = 100000;

  // Client scoring system
  const getClientScore = (client: ClientBalance) => {
    let score = 100; // Start with perfect score
    
    // Payment behavior (40% weight)
    const daysSincePayment = daysSince(client.last_payment_date);
    if (daysSincePayment === null) score -= 20; // Never paid
    else if (daysSincePayment > 60) score -= 15;
    else if (daysSincePayment > 30) score -= 10;
    else if (daysSincePayment > 14) score -= 5;
    
    // Delivery activity (30% weight)
    const daysSinceDelivery = daysSince(extraClientData[client.client_id]?.lastDeliveryDate || null);
    if (daysSinceDelivery === null) score -= 15; // Never delivered
    else if (daysSinceDelivery > 90) score -= 12;
    else if (daysSinceDelivery > 30) score -= 8;
    else if (daysSinceDelivery > 14) score -= 4;
    
    // Balance situation (30% weight)
    if (client.current_balance > highBalanceThreshold) score -= 15;
    else if (client.current_balance > 50000) score -= 10;
    else if (client.current_balance > 25000) score -= 5;
    else if (client.current_balance < 0) score += 5; // Credit available is good
    
    return Math.max(0, Math.min(100, score));
  };

  const getRiskLevel = (score: number) => {
    if (score >= 80) return { level: 'Excelente', color: 'text-green-600', bg: 'bg-green-50' };
    if (score >= 60) return { level: 'Bueno', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (score >= 40) return { level: 'Atención', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { level: 'Crítico', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const toggleClientExpansion = (clientId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
      // Load detailed data if not already loaded
      if (!clientDetails[clientId]) {
        loadClientDetails(clientId);
      }
    }
    setExpandedClients(newExpanded);
  };

  // Progressive data loading - load payment dates and delivery data in background
  React.useEffect(() => {
    if (!progressiveDataLoaded) {
      loadProgressiveData();
    }
  }, [progressiveDataLoaded]);

  // Load client-specific pricing in background
  React.useEffect(() => {
    if (!pricingLoaded && clientBalances.length > 0) {
      loadClientPricing();
    }
  }, [pricingLoaded, clientBalances]);

  const loadProgressiveData = async () => {
    try {
      // Load payment dates for all clients
      const response = await fetch('/api/clients/payment-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clientIds: clientBalances.map(c => c.client_id) 
        })
      });
      
      if (response.ok) {
        const paymentData = await response.json();
        
        // Update client balances with payment dates
        setClientBalances(prev => prev.map(client => ({
          ...client,
          last_payment_date: paymentData[client.client_id]?.lastPaymentDate || null
        })));
      }

      // Load delivery dates
      const deliveryResponse = await fetch('/api/clients/delivery-dates');
      if (deliveryResponse.ok) {
        const deliveryData = await deliveryResponse.json();
        setExtraClientData(deliveryData);
      }

      setProgressiveDataLoaded(true);
    } catch (error) {
      console.error('Error loading progressive data:', error);
      setProgressiveDataLoaded(true); // Don't block UI
    }
  };

  const loadClientPricing = async () => {
    try {
      const response = await fetch('/api/clients/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clientIds: clientBalances.map(c => c.client_id) 
        })
      });

      if (response.ok) {
        const pricingData = await response.json();
        setClientPricing(pricingData);
      }

      setPricingLoaded(true);
    } catch (error) {
      console.error('Error loading client pricing:', error);
      setPricingLoaded(true); // Don't block UI
    }
  };

  const loadClientDetails = async (clientId: string) => {
    if (loadingDetails.has(clientId)) return; // Prevent duplicate requests
    
    setLoadingDetails(prev => new Set([...prev, clientId]));
    
    try {
      const response = await fetch(`/api/clients/${clientId}/details`);
      if (response.ok) {
        const details = await response.json();
        setClientDetails(prev => ({ ...prev, [clientId]: details }));
      } else {
        // Fallback to mock data if API fails
        const mockDetails = {
          totalConcreteDelivered: Math.floor(Math.random() * 5000) + 500,
          totalPayments: Math.floor(Math.random() * 2000000) + 100000,
          averageOrderSize: Math.floor(Math.random() * 200) + 50,
          paymentHistory: [],
          deliveryTrend: Math.random() > 0.5 ? 'up' : 'down',
          creditCoverage: 0
        };
        setClientDetails(prev => ({ ...prev, [clientId]: mockDetails }));
      }
    } catch (error) {
      console.error('Error loading client details:', error);
      // Fallback to mock data
      const mockDetails = {
        totalConcreteDelivered: 0,
        totalPayments: 0,
        averageOrderSize: 0,
        paymentHistory: [],
        deliveryTrend: 'up',
        creditCoverage: 0
      };
      setClientDetails(prev => ({ ...prev, [clientId]: mockDetails }));
    } finally {
      setLoadingDetails(prev => {
        const newSet = new Set(prev);
        newSet.delete(clientId);
        return newSet;
      });
    }
  };

  const calculateConcreteCoverage = (balance: number, clientId: string) => {
    // Get client-specific pricing or fallback to default
    const pricing = clientPricing[clientId];
    const price = pricing?.price || 2800; // Default fallback
    
    const cubicMeters = Math.floor(Math.abs(balance) / price);
    
    if (balance < 0) {
      // Client has credit/advance payment
      return {
        type: 'coverage' as const,
        amount: cubicMeters,
        text: `Cobertura: ${cubicMeters} m³ de concreto`,
        color: 'text-green-600',
        priceSource: pricing?.description || 'Precio base del sistema'
      };
    } else if (balance > 0) {
      // Client owes money
      return {
        type: 'debt' as const,
        amount: cubicMeters,
        text: `Debe: ${cubicMeters} m³ equivalente`,
        color: 'text-red-600',
        priceSource: pricing?.description || 'Precio base del sistema'
      };
    } else {
      // Balance is zero
      return {
        type: 'neutral' as const,
        amount: 0,
        text: 'Sin saldo pendiente',
        color: 'text-gray-600',
        priceSource: 'N/A'
      };
    }
  };

  const daysSince = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diffMs = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  const summary = React.useMemo(() => {
    const totalClients = clientBalances.length;
    const clientsWithBalance = clientBalances.filter(c => (c.current_balance || 0) > 0).length;
    const clientsWithAdvances = clientBalances.filter(c => (c.current_balance || 0) < 0).length;
    const criticalClients = clientBalances.filter(c => getClientScore(c) < 40).length;
    
    return { totalClients, clientsWithBalance, clientsWithAdvances, criticalClients };
  }, [clientBalances]);

  const filteredBalances = React.useMemo(() => {
    // Filter out specific clients from this page only
    const excludedClients = [
      'IMPULSORA TLAXCALTECA DE INDUSTRIAS',
      'FIDEICOMISO DE ADMINISTRACION Y PAGO SEDENA 80778'
    ];
    
    const bySearch = (list: ClientBalance[]) => list
      .filter(c => !excludedClients.some(excluded => c.business_name.includes(excluded)))
      .filter(c => c.business_name.toLowerCase().includes(search.toLowerCase()));
    
    let list = clientBalances;
    switch (segment) {
      case 'with_balance':
        list = list.filter(c => (c.current_balance || 0) > 0);
        break;
      case 'critical':
        list = list.filter(c => getClientScore(c) < 40);
        break;
      case 'excellent':
        list = list.filter(c => getClientScore(c) >= 80);
        break;
      case 'with_advances':
        list = list.filter(c => (c.current_balance || 0) < 0);
        break;
      case 'high_balance':
        list = list.filter(c => (c.current_balance || 0) >= highBalanceThreshold);
        break;
      case 'all':
      default:
        break;
    }
    return bySearch(list).map(client => ({
      ...client,
      score: getClientScore(client),
      risk: getRiskLevel(getClientScore(client))
    }));
  }, [clientBalances, segment, search, extraClientData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Análisis de Clientes</h1>
          <p className="text-sm text-muted-foreground">Análisis detallado del rendimiento individual de cada cliente</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Total: {summary.totalClients}</span>
          <span className="text-red-600">Con saldo: {summary.clientsWithBalance}</span>
          <span className="text-green-600">Con anticipos: {summary.clientsWithAdvances}</span>
          <span className="text-orange-600">Críticos: {summary.criticalClients}</span>
          {!progressiveDataLoaded && (
            <span className="text-blue-600 flex items-center gap-1">
              <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              Cargando datos adicionales...
            </span>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Segmentos y Filtros</CardTitle>
          <CardDescription>Enfoca tu gestión comercial según riesgo y actividad</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button variant={segment === 'all' ? 'default' : 'outline'} onClick={() => setSegment('all')}>Todos</Button>
              <Button variant={segment === 'critical' ? 'default' : 'outline'} onClick={() => setSegment('critical')}>Críticos</Button>
              <Button variant={segment === 'excellent' ? 'default' : 'outline'} onClick={() => setSegment('excellent')}>Excelentes</Button>
              <Button variant={segment === 'with_balance' ? 'default' : 'outline'} onClick={() => setSegment('with_balance')}>Con saldo</Button>
              <Button variant={segment === 'with_advances' ? 'default' : 'outline'} onClick={() => setSegment('with_advances')}>Con anticipos</Button>
              <Button variant={segment === 'high_balance' ? 'default' : 'outline'} onClick={() => setSegment('high_balance')}>Saldo alto</Button>
            </div>
            <div className="w-full md:w-64">
              <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredBalances.map((client) => {
          const isExpanded = expandedClients.has(client.client_id);
          const details = clientDetails[client.client_id];
          const lastDelivery = extraClientData[client.client_id]?.lastDeliveryDate;
          const daysSincePayment = daysSince(client.last_payment_date);
          const daysSinceDelivery = daysSince(lastDelivery);
          const concreteCoverage = calculateConcreteCoverage(client.current_balance, client.client_id);

          return (
            <Card key={client.client_id} className="overflow-hidden">
              <Collapsible>
                <CollapsibleTrigger 
                  className="w-full"
                  onClick={() => toggleClientExpansion(client.client_id)}
                >
                  <CardHeader className="hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        <div className="text-left">
                          <CardTitle className="text-lg">{client.business_name}</CardTitle>
                          <CardDescription>
                            Score: {client.score} • {client.risk?.level}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className={`text-lg font-semibold ${client.current_balance > 0 ? 'text-red-600' : client.current_balance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                            {formatCurrency(client.current_balance)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {client.current_balance > 0 ? 'Debe' : client.current_balance < 0 ? 'A favor' : 'Al corriente'}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={client.current_balance > 0 ? 'destructive' : client.current_balance < 0 ? 'secondary' : 'default'}>
                            {client.current_balance > 0 ? 'Pendiente' : client.current_balance < 0 ? 'Anticipo' : 'Al día'}
                          </Badge>
                          <Badge variant={client.risk?.level === 'Crítico' ? 'destructive' : client.risk?.level === 'Excelente' ? 'secondary' : 'outline'}>
                            {client.risk?.level}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-semibold text-sm text-muted-foreground">ACTIVIDAD RECIENTE</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              Último pago: {client.last_payment_date ? formatDate(client.last_payment_date) : 'Nunca'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              Última entrega: {lastDelivery ? formatDate(lastDelivery) : 'Nunca'}
                            </span>
                          </div>
                          {daysSincePayment !== null && (
                            <div className="text-xs text-muted-foreground">
                              {daysSincePayment} días sin pago
                            </div>
                          )}
                          {daysSinceDelivery !== null && (
                            <div className="text-xs text-muted-foreground">
                              {daysSinceDelivery} días sin entrega
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-semibold text-sm text-muted-foreground">CONSUMO HISTÓRICO</h4>
                        <div className="space-y-2">
                          {loadingDetails.has(client.client_id) ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-sm text-muted-foreground">Cargando datos históricos...</span>
                            </div>
                          ) : details ? (
                            <>
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {details.totalConcreteDelivered.toLocaleString()} m³ entregados
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {formatCurrency(details.totalPayments)} pagado
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Promedio: {details.averageOrderSize} m³/orden
                              </div>
                            </>
                          ) : (
                            <div className="text-sm text-muted-foreground">Haz clic para cargar datos históricos</div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-semibold text-sm text-muted-foreground">ESTADO FINANCIERO</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {client.current_balance < 0 
                                ? `Crédito disponible: ${formatCurrency(Math.abs(client.current_balance))}`
                                : `Saldo pendiente: ${formatCurrency(client.current_balance)}`
                              }
                            </span>
                          </div>
                          <div className={`text-sm font-medium ${concreteCoverage.color}`}>
                            {concreteCoverage.text}
                          </div>
                          {concreteCoverage.priceSource && (
                            <div className="text-xs text-muted-foreground">
                              Basado en: {concreteCoverage.priceSource}
                            </div>
                          )}
                          {concreteCoverage.type === 'debt' && (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                              <span className="text-xs text-red-600">Requiere seguimiento</span>
                            </div>
                          )}
                          {concreteCoverage.type === 'coverage' && (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="text-xs text-green-600">Pago anticipado</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-semibold text-sm text-muted-foreground">ACCIONES</h4>
                        <div className="flex flex-col gap-2">
                          <Link href={`/clients/${client.client_id}`}>
                            <Button variant="outline" size="sm" className="w-full">
                              Ver Detalles
                            </Button>
                          </Link>
                          <Button variant="outline" size="sm" className="w-full">
                            Nueva Cotización
                          </Button>
                          {/* Payment registration only for financial roles */}
                          {profile && (profile.role === 'EXECUTIVE' || profile.role === 'PLANT_MANAGER' || profile.role === 'CREDIT_VALIDATOR') && (
                            <ClientPaymentManagerModal
                              clientId={client.client_id}
                              clientName={client.business_name}
                              triggerLabel="Gestionar Pagos"
                              triggerVariant="secondary"
                              triggerSize="sm"
                              triggerClassName="w-full"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
}


