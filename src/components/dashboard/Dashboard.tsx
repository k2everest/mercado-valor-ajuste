import { useState, useEffect } from 'react';
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MercadoLibreConnection } from "./MercadoLibreConnection";
import { ProductsList } from "./ProductsList";
import { SettingsPanel } from "./SettingsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Settings, ShoppingCart, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product, PaginationInfo } from './types';

export const Dashboard = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    initializeDashboard();
  }, []);

  const initializeDashboard = async () => {
    console.log('🚀 Inicializando Dashboard...');
    setInitializing(true);
    
    try {
      const accessToken = localStorage.getItem('ml_access_token');
      const tokenTimestamp = localStorage.getItem('ml_token_timestamp');
      
      console.log('🔑 Token no localStorage:', accessToken ? 'Encontrado' : 'Não encontrado');
      
      if (!accessToken) {
        console.log('❌ Nenhum token encontrado, usuário não conectado');
        setIsConnected(false);
        setInitializing(false);
        return;
      }

      // Check if token is expired (ML tokens last 6 months = 6 * 30 * 24 * 60 * 60 * 1000)
      const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
      const tokenAge = tokenTimestamp ? Date.now() - parseInt(tokenTimestamp) : SIX_MONTHS_MS + 1;
      
      if (tokenAge > SIX_MONTHS_MS) {
        console.log('🕐 Token expirado (mais de 6 meses), limpando...');
        clearStoredData();
        setIsConnected(false);
        setConnectionError('Token expirado. Reconecte-se ao Mercado Livre.');
        setInitializing(false);
        return;
      }

      // Validate token with API
      const isValidToken = await validateToken(accessToken);
      if (!isValidToken) {
        console.log('❌ Token inválido, limpando dados...');
        clearStoredData();
        setIsConnected(false);
        setInitializing(false);
        return;
      }

      console.log('✅ Token válido, carregando dados...');
      setIsConnected(true);
      
      // Load cached data first
      const storedProducts = localStorage.getItem('ml_products_cache');
      const storedLastSync = localStorage.getItem('ml_last_sync');
      
      if (storedProducts && storedLastSync) {
        try {
          const cached = JSON.parse(storedProducts);
          console.log('📦 Carregando produtos do cache:', cached.products?.length || 0);
          setProducts(cached.products || []);
          setPagination(cached.pagination || null);
          setLastSync(storedLastSync);
        } catch (error) {
          console.error('Erro ao carregar cache:', error);
          localStorage.removeItem('ml_products_cache');
          localStorage.removeItem('ml_last_sync');
        }
      }

      // If no cached data, load fresh data
      if (!storedProducts) {
        console.log('📥 Nenhum cache encontrado, carregando dados frescos...');
        await loadProducts();
      }

    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      setConnectionError('Erro ao inicializar dashboard');
    } finally {
      setInitializing(false);
    }
  };

  const clearStoredData = () => {
    localStorage.removeItem('ml_access_token');
    localStorage.removeItem('ml_token_timestamp');
    localStorage.removeItem('ml_products_cache');
    localStorage.removeItem('ml_last_sync');
    setProducts([]);
    setPagination(null);
    setLastSync(null);
    setConnectionError(null);
  };

  const validateToken = async (token: string): Promise<boolean> => {
    try {
      console.log('🔍 Validando token...');
      const response = await fetch('https://api.mercadolibre.com/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.status === 401) {
        console.log('🔑 Token expirado/inválido');
        return false;
      }
      
      if (!response.ok) {
        console.log('⚠️ Erro ao validar token:', response.status);
        return false;
      }
      
      console.log('✅ Token válido');
      return true;
    } catch (error) {
      console.error('❌ Erro ao validar token:', error);
      return false;
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    setConnectionError(null);
    
    try {
      const accessToken = localStorage.getItem('ml_access_token');
      if (!accessToken) {
        throw new Error('Token de acesso não encontrado');
      }

      console.log('📦 Carregando produtos...');

      const { data, error } = await supabase.functions.invoke('mercadolivre-products', {
        body: { 
          accessToken,
          limit: 50,
          offset: 0
        }
      });

      if (error) {
        console.error('❌ Erro ao carregar produtos:', error);
        
        if (error.message?.includes('INVALID_TOKEN') || error.message?.includes('unauthorized')) {
          console.log('🗑️ Token inválido detectado, limpando dados...');
          clearStoredData();
          setIsConnected(false);
          setConnectionError('Token de acesso expirado. Reconecte-se ao Mercado Livre.');
          return;
        }
        
        throw error;
      }

      console.log('✅ Produtos carregados:', data.products?.length || 0);
      console.log('📊 Pagination data:', data.pagination);

      setProducts(data.products || []);
      setPagination(data.pagination || null);

      // Cache the results
      const cacheData = {
        products: data.products || [],
        pagination: data.pagination || null,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('ml_products_cache', JSON.stringify(cacheData));
      localStorage.setItem('ml_last_sync', new Date().toISOString());
      setLastSync(new Date().toISOString());

      if (data.products?.length > 0) {
        toast({
          title: "✅ Produtos sincronizados!",
          description: `${data.products.length} produtos atualizados com sucesso`,
        });
      } else {
        toast({
          title: "⚠️ Nenhum produto encontrado",
          description: "Você não possui produtos ativos no Mercado Livre",
        });
      }

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

  const forceSync = async () => {
    localStorage.removeItem('ml_products_cache');
    localStorage.removeItem('ml_last_sync');
    await loadProducts();
  };

  const handleConnect = (newProducts: Product[]) => {
    console.log('🔗 Dashboard: Nova conexão estabelecida');
    setProducts(newProducts);
    setIsConnected(true);
    setConnectionError(null);
    setLastSync(new Date().toISOString());
    
    // Store token timestamp when connecting
    localStorage.setItem('ml_token_timestamp', Date.now().toString());
  };

  const handleLoadMore = (newProducts: Product[], newPagination: PaginationInfo) => {
    console.log('📄 Dashboard: Carregando mais produtos:', { 
      newProductsCount: newProducts.length, 
      newPagination 
    });
    setProducts(newProducts);
    setPagination(newPagination);
    
    // Update cache
    const cacheData = {
      products: newProducts,
      pagination: newPagination,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('ml_products_cache', JSON.stringify(cacheData));
  };

  if (initializing) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-400 animate-pulse" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Inicializando...</h3>
            <p className="text-gray-600">
              Verificando sua conexão e carregando dados...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {t('dashboard.title')}
            </h1>
            <p className="text-gray-600">
              {t('dashboard.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {lastSync && (
              <div className="text-sm text-gray-500">
                Última sincronização: {new Date(lastSync).toLocaleString()}
              </div>
            )}
            <Button
              onClick={forceSync}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sincronizar
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Produtos ({products.length})
            {pagination && pagination.hasMore && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full ml-1">
                +{pagination.total - products.length}
              </span>
            )}
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
          ) : products.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto encontrado</h3>
                <p className="text-gray-600 mb-4">
                  Você não possui produtos ativos no Mercado Livre ou eles ainda não foram carregados.
                </p>
                <Button onClick={loadProducts} disabled={loading}>
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Tentar Novamente
                    </>
                  )}
                </Button>
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
