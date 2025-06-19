
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
  const { t } = useLanguage();

  useEffect(() => {
    const accessToken = localStorage.getItem('ml_access_token');
    const storedProducts = localStorage.getItem('ml_products_cache');
    const storedLastSync = localStorage.getItem('ml_last_sync');
    
    if (accessToken) {
      setIsConnected(true);
      setLastSync(storedLastSync);
      
      // Load cached products if available
      if (storedProducts) {
        try {
          const cached = JSON.parse(storedProducts);
          setProducts(cached.products);
          setPagination(cached.pagination);
          console.log('📦 Produtos carregados do cache:', cached.products.length);
        } catch (error) {
          console.error('Erro ao carregar cache:', error);
        }
      }
      
      // Check for updates only if we have cached data
      if (storedProducts && storedLastSync) {
        checkForUpdates();
      } else {
        loadProducts();
      }
    }
  }, []);

  const validateToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch('https://api.mercadolibre.com/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.status === 401) {
        console.log('🔑 Token inválido detectado');
        localStorage.removeItem('ml_access_token');
        localStorage.removeItem('ml_products_cache');
        localStorage.removeItem('ml_last_sync');
        setIsConnected(false);
        setConnectionError('Token de acesso expirado. Reconecte-se ao Mercado Livre.');
        return false;
      }
      
      return response.ok;
    } catch (error) {
      console.error('Erro ao validar token:', error);
      return false;
    }
  };

  const checkForUpdates = async () => {
    const accessToken = localStorage.getItem('ml_access_token');
    if (!accessToken) return;

    console.log('🔍 Verificando atualizações...');
    
    const isValidToken = await validateToken(accessToken);
    if (!isValidToken) return;

    try {
      // Get just the first few products to check for changes
      const { data, error } = await supabase.functions.invoke('mercadolivre-products', {
        body: { 
          accessToken,
          limit: 5,
          offset: 0
        }
      });

      if (error) {
        throw error;
      }

      // Compare with cached data
      const storedProducts = localStorage.getItem('ml_products_cache');
      if (storedProducts) {
        const cached = JSON.parse(storedProducts);
        const hasChanges = data.products.some((newProduct: Product) => {
          const cachedProduct = cached.products.find((p: Product) => p.id === newProduct.id);
          return !cachedProduct || 
                 cachedProduct.title !== newProduct.title ||
                 cachedProduct.originalPrice !== newProduct.originalPrice ||
                 cachedProduct.status !== newProduct.status;
        });

        if (!hasChanges) {
          console.log('✅ Nenhuma atualização necessária');
          return;
        }
      }

      console.log('📥 Atualizações detectadas, recarregando...');
      loadProducts();

    } catch (error: any) {
      console.error('Erro ao verificar atualizações:', error);
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

      const isValidToken = await validateToken(accessToken);
      if (!isValidToken) return;

      console.log('📦 Carregando produtos...');

      const { data, error } = await supabase.functions.invoke('mercadolivre-products', {
        body: { 
          accessToken,
          limit: 50, // Increased from 20 to 50
          offset: 0
        }
      });

      if (error) {
        console.error('❌ Erro ao carregar produtos:', error);
        
        if (error.message?.includes('INVALID_TOKEN') || error.message?.includes('unauthorized')) {
          console.log('🗑️ Token inválido detectado, removendo...');
          localStorage.removeItem('ml_access_token');
          localStorage.removeItem('ml_products_cache');
          localStorage.removeItem('ml_last_sync');
          setIsConnected(false);
          setConnectionError('Token de acesso expirado. Reconecte-se ao Mercado Livre.');
          return;
        }
        
        throw error;
      }

      console.log('✅ Produtos carregados:', data.products?.length || 0);

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

      toast({
        title: "✅ Produtos sincronizados!",
        description: `${data.products?.length || 0} produtos atualizados com sucesso`,
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
