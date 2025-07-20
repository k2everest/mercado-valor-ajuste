
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
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | undefined>();
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

      // Carregar últimos cálculos se autenticado
      if (user && hasMLConnection) {
        loadLastCalculations().then(savedProducts => {
          if (savedProducts.length > 0) {
            console.log('📋 Carregando cálculos salvos:', savedProducts.length);
            setProducts(savedProducts);
            setCurrentZipCode(lastZipCode);
            
            toast({
              title: "📋 Cálculos restaurados",
              description: `${savedProducts.length} produtos com cálculos anteriores carregados`,
            });
          }
        });
      }
    };
    
    checkConnection();
  }, [user, navigate, loadLastCalculations, lastZipCode]);

  // Salvar cálculos automaticamente quando produtos ou CEP mudam
  useEffect(() => {
    if (user && currentZipCode && products.length > 0) {
      const calculatedProducts = products.filter(p => 
        p.freightCost !== undefined && p.sellerFreightCost !== undefined
      );
      
      if (calculatedProducts.length > 0) {
        console.log('💾 Salvando cálculos automaticamente...');
        saveCalculations(products, currentZipCode);
      }
    }
  }, [products, currentZipCode, user, saveCalculations]);

  const handleConnectionChange = (connected: boolean) => {
    setHasConnection(connected);
    if (!connected) {
      setProducts([]);
      setPagination(undefined);
      // Redirecionar para home quando desconectado
      console.log('🔌 Desconectado do ML, redirecionando...');
      navigate('/');
    }
  };

  const handleConnect = (newProducts: Product[], newPagination?: PaginationInfo) => {
    console.log('🔄 Dashboard: Atualizando produtos do MercadoLibreConnection:', newProducts.length);
    setProducts(newProducts);
    setPagination(newPagination);
  };

  const handleLoadMore = (newProducts: Product[], newPagination: PaginationInfo) => {
    setProducts(newProducts);
    setPagination(newPagination);
  };

  const handleFreightCalculated = (productId: string, freightData: {
    freightCost: number;
    sellerFreightCost: number;
    freightMethod: string;
  }) => {
    setProducts(prev => prev.map(product => {
      if (product.id === productId) {
        return {
          ...product,
          ...freightData,
          adjustedPrice: undefined
        };
      }
      return product;
    }));
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
                products={products}
                pagination={pagination}
                onLoadMore={handleLoadMore}
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
            <FreightCalculator 
              products={products}
              onFreightCalculated={handleFreightCalculated}
              loadingFreight={loadingFreight}
              setLoadingFreight={setLoadingFreight}
              initialZipCode={lastZipCode}
              onZipCodeChange={handleZipCodeChange}
            />
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
