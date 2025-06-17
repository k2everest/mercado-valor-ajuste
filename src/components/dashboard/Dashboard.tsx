
import { useState, useEffect } from 'react';
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MercadoLibreConnection } from "./MercadoLibreConnection";
import { ProductsList } from "./ProductsList";
import { SettingsPanel } from "./SettingsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Settings, ShoppingCart, AlertTriangle } from "lucide-react";
import { Product, PaginationInfo } from './types';

export const Dashboard = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const accessToken = localStorage.getItem('ml_access_token');
    if (accessToken) {
      setIsConnected(true);
      loadProducts();
    }
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    setConnectionError(null);
    
    try {
      const accessToken = localStorage.getItem('ml_access_token');
      if (!accessToken) {
        throw new Error('Token de acesso não encontrado');
      }

      console.log('📦 Carregando produtos iniciais...');

      const { data, error } = await supabase.functions.invoke('mercadolivre-products', {
        body: { 
          accessToken,
          limit: 20,
          offset: 0
        }
      });

      if (error) {
        console.error('❌ Erro ao carregar produtos:', error);
        
        if (error.message?.includes('INVALID_TOKEN') || error.message?.includes('unauthorized')) {
          console.log('🗑️ Token inválido detectado, removendo...');
          localStorage.removeItem('ml_access_token');
          setIsConnected(false);
          setConnectionError('Token de acesso expirado. Reconecte-se ao Mercado Livre.');
          return;
        }
        
        throw error;
      }

      console.log('✅ Produtos carregados:', data.products?.length || 0);

      setProducts(data.products || []);
      setPagination(data.pagination || null);

      toast({
        title: "✅ Produtos carregados!",
        description: `${data.products?.length || 0} produtos importados com sucesso`,
      });

    } catch (error: any) {
      console.error('💥 Erro ao carregar produtos:', error);
      setConnectionError(error.message || 'Erro ao carregar produtos');
      
      toast({
        title: "❌ Erro ao carregar produtos",
        description: error.message || 'Erro desconhecido',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (newProducts: Product[]) => {
    console.log('🔗 Dashboard: Nova conexão estabelecida');
    setProducts(newProducts);
    setIsConnected(true);
    setConnectionError(null);
  };

  const handleLoadMore = (newProducts: Product[], newPagination: PaginationInfo) => {
    console.log('📄 Dashboard: Carregando mais produtos:', { 
      newProductsCount: newProducts.length, 
      newPagination 
    });
    setProducts(newProducts);
    setPagination(newPagination);
  };

  // Show connection error if exists
  if (connectionError) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-900">Erro de Conexão</h3>
                <p className="text-red-700">{connectionError}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="mt-6">
          <MercadoLibreConnection onConnect={handleConnect} />
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <MercadoLibreConnection onConnect={handleConnect} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('dashboard.title')}
        </h1>
        <p className="text-gray-600">
          {t('dashboard.subtitle')}
        </p>
      </div>

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-400 animate-pulse" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Carregando produtos...</h3>
                <p className="text-gray-600">
                  Buscando seus produtos do Mercado Livre...
                </p>
              </CardContent>
            </Card>
          ) : (
            <ProductsList 
              products={products} 
              pagination={pagination}
              onLoadMore={handleLoadMore}
            />
          )}
        </TabsContent>

        <TabsContent value="settings">
          <SettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};
