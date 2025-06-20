
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { MercadoLibreConnection } from "./MercadoLibreConnection";
import { ProductsList } from "./ProductsList";
import { FreightCalculator } from "./FreightCalculator";
import { SettingsPanel } from "./SettingsPanel";
import { ApiTestPanel } from "./ApiTestPanel";
import { Calculator, Package, Settings, TestTube, ShoppingCart } from "lucide-react";

export const Dashboard = () => {
  const { user } = useAuth();
  const [hasConnection, setHasConnection] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ml_access_token');
    setHasConnection(!!token);
  }, []);

  const handleConnectionChange = (connected: boolean) => {
    setHasConnection(connected);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Dashboard MercadoValor
            </h1>
            <p className="text-gray-600">
              Bem-vindo, {user?.email || 'Usuário'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={hasConnection ? "default" : "secondary"}>
              {hasConnection ? "Conectado ao ML" : "Desconectado"}
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="connection" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="connection" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Conexão
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="calculator" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Calculadora
            </TabsTrigger>
            <TabsTrigger value="test" className="flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              Teste API
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connection">
            <MercadoLibreConnection onConnectionChange={handleConnectionChange} />
          </TabsContent>

          <TabsContent value="products">
            {hasConnection ? (
              <ProductsList />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Produtos do Mercado Livre</CardTitle>
                  <CardDescription>
                    Conecte-se ao Mercado Livre primeiro para ver seus produtos
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="calculator">
            <FreightCalculator />
          </TabsContent>

          <TabsContent value="test">
            <ApiTestPanel />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
