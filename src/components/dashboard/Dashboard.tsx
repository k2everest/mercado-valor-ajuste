
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useFreightPersistence } from "@/hooks/useFreightPersistence";
import { SecureStorage } from "@/utils/secureStorage";
import { MercadoLibreConnection } from "./MercadoLibreConnection";
import { ProductsList } from "./ProductsList";
import { FreightCalculator } from "./FreightCalculator";
import { SettingsPanel } from "./SettingsPanel";
import { ApiTestPanel } from "./ApiTestPanel";
import { Calculator, Package, Settings, TestTube, ShoppingCart } from "lucide-react";
import { Product, PaginationInfo } from './types';
import { toast } from "@/hooks/use-toast";

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hasConnection, setHasConnection] = useState(false);
  const [loadingFreight, setLoadingFreight] = useState<Record<string, boolean>>({});
  const [currentZipCode, setCurrentZipCode] = useState('');
  const { 
    lastZipCode, 
    isLoading: isLoadingCalculations, 
    loadLastCalculations, 
    saveCalculations 
  } = useFreightPersistence();

  // Verificar conexão ML e carregar dados persistidos
  useEffect(() => {
    const checkConnection = async () => {
      const tokens = await SecureStorage.getMLTokens();
      const hasMLConnection = !!(tokens && !(await SecureStorage.isMLTokenExpired()));
      
      console.log('🔍 Verificando conexão ML:', { hasMLConnection });
      setHasConnection(hasMLConnection);
      
      // Se não tem conexão com ML, redirecionar para home
      if (!hasMLConnection) {
        console.log('❌ Sem conexão ML, redirecionando para home...');
        toast({
          title: "🔌 Conexão necessária",
          description: "Conecte-se ao Mercado Livre para acessar o dashboard",
        });
        navigate('/');
        return;
      }

      // Carregar último CEP usado
      if (user && hasMLConnection && lastZipCode) {
        setCurrentZipCode(lastZipCode);
      }
    };
    
    checkConnection();
  }, [user, navigate, loadLastCalculations, lastZipCode]);


  const handleConnectionChange = (connected: boolean) => {
    setHasConnection(connected);
    if (!connected) {
      // Redirecionar para home quando desconectado
      console.log('🔌 Desconectado do ML, redirecionando...');
      navigate('/');
    }
  };

  const handleConnect = () => {
    console.log('🔄 Dashboard: Conexão estabelecida');
  };

  const handleZipCodeChange = (zipCode: string) => {
    setCurrentZipCode(zipCode);
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
            {isLoadingCalculations && (
              <p className="text-sm text-blue-600 mt-1">
                📋 Carregando cálculos anteriores...
              </p>
            )}
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
            <MercadoLibreConnection 
              onConnectionChange={handleConnectionChange}
              onConnect={handleConnect}
            />
          </TabsContent>

           <TabsContent value="products">
            {hasConnection ? (
              <ProductsList 
                products={[]}
                pagination={undefined}
                onLoadMore={() => {}}
              />
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
            <Card>
              <CardHeader>
                <CardTitle>Calculadora de Frete</CardTitle>
                <CardDescription>
                  Use a aba "Produtos" para acessar a calculadora integrada
                </CardDescription>
              </CardHeader>
            </Card>
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
