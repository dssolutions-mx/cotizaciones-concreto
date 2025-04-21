import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FinancialMetricsSkeleton, 
  ClientBalanceTableSkeleton, 
  CreditApprovalSkeleton 
} from "./FinancialMetricsSkeleton";

export function FinancialDashboardSkeleton() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Centro Financiero</h1>
      
      <div className="space-y-8">
        {/* Financial metrics summary cards */}
        <FinancialMetricsSkeleton />
        
        {/* Tabbed interface skeleton */}
        <Tabs defaultValue="balances" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="balances">Balances de Clientes</TabsTrigger>
            <TabsTrigger value="credit">Aprobación de Crédito</TabsTrigger>
          </TabsList>
          
          {/* Client Balances Tab */}
          <TabsContent value="balances" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Balances de Clientes</CardTitle>
                <CardDescription>
                  Visualiza los saldos pendientes de todos los clientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ClientBalanceTableSkeleton />
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Credit Approval Tab */}
          <TabsContent value="credit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Órdenes Pendientes de Aprobación de Crédito</CardTitle>
                <CardDescription>
                  Gestiona las órdenes que requieren aprobación de crédito antes de ser procesadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreditApprovalSkeleton />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 