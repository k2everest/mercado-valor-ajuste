
import { useState, useEffect } from 'react';
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MercadoLibreConnection } from "./MercadoLibreConnection";
import { ProductsList } from "./ProductsList";
import { SettingsPanel } from "./SettingsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Settings, ShoppingCart } from "lucide-react";

interface Product {
  id: string;
  title: string;
  originalPrice: number;
  status: 'active' | 'paused' | 'closed';
  freeShipping: boolean;
  adjustedPrice?: number;
  permalink?: string;
  thumbnail?: string;
  availableQuantity?: number;
  soldQuantity?: number;
  freightCost?: number;
  sellerFreightCost?: number;
  freightMethod?: string;
}

interface PaginationInfo {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export const Dashboard = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(false);
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
    try {
      const accessToken = localStorage.getItem('ml_access_token');
      if (!accessToken) {
        throw new Error('Token de acesso não encontrado');
      }

      console.log('Loading initial products...');

      const { data, error } = await supabase.functions.invoke('mercadolivre-products', {
        body: { 
          accessToken,
          limit: 20,
          offset: 0
        }
      });

      if (error) throw error;

      console.log('Products loaded:', data.products.length);
      console.log('Pagination info:', data.pagination);

      setProducts(data.products || []);
      setPagination(data.pagination || null);

      toast({
        title: "✅ Produtos carregados!",
        description: `${data.products.length} produtos importados com sucesso`,
      });

    } catch (error: any) {
      console.error('Error loading products:', error);
      toast({
        title: "❌ Erro ao carregar produtos",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectionChange = (connected: boolean) => {
    setIsConnected(connected);
    if (connected) {
      loadProducts();
    } else {
      setProducts([]);
      setPagination(null);
    }
  };

  const handleLoadMore = (newProducts: Product[], newPagination: PaginationInfo) => {
    console.log('Dashboard handleLoadMore called:', { 
      newProductsCount: newProducts.length, 
      newPagination 
    });
    setProducts(newProducts);
    setPagination(newPagination);
  };

  if (!isConnected) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <MercadoLibreConnection />
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
