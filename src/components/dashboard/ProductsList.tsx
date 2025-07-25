
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SecureStorage } from "@/utils/secureStorage";
import { ProductsPagination } from "./ProductsPagination";
import { FreightCalculator } from "./FreightCalculator";
import { ProductActions } from "./ProductActions";
import { ProductCard } from "./ProductCard";
import { Package, Truck, X, RefreshCw } from "lucide-react";
import { Product, ProductsListProps } from './types';
import { useFreightCalculation } from "@/hooks/useFreightCalculation";

// Cache manager for products to prevent duplicate loading
class ProductsCache {
  private static instance: ProductsCache;
  private products: Product[] = [];
  private isLoading: boolean = false;
  private hasLoaded: boolean = false;

  static getInstance(): ProductsCache {
    if (!ProductsCache.instance) {
      ProductsCache.instance = new ProductsCache();
    }
    return ProductsCache.instance;
  }

  getProducts(): Product[] {
    return this.products;
  }

  setProducts(products: Product[]): void {
    this.products = products;
    this.hasLoaded = true;
  }

  isLoadingProducts(): boolean {
    return this.isLoading;
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  hasLoadedProducts(): boolean {
    return this.hasLoaded;
  }

  clear(): void {
    this.products = [];
    this.isLoading = false;
    this.hasLoaded = false;
  }
}

export const ProductsList = ({ products: initialProducts, pagination, onLoadMore }: ProductsListProps) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loadingFreight, setLoadingFreight] = useState<Record<string, boolean>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [shippingFilter, setShippingFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [autoCalculatingFreights, setAutoCalculatingFreights] = useState(false);
  const [refreshingFreights, setRefreshingFreights] = useState(false);
  
  // CEP da Rua Dr. Dolzani 677, Jardim da Glória, São Paulo - SP
  const DEFAULT_SENDER_ZIP = '01546-000';
  
  const cache = ProductsCache.getInstance();
  const { fetchFreightCosts } = useFreightCalculation();

  console.log('ProductsList rendered with:', {
    productsCount: products.length,
    pagination,
    hasOnLoadMore: !!onLoadMore,
    hasMore: pagination?.hasMore,
    paginationTotal: pagination?.total,
    showPagination: !!(pagination && pagination.hasMore && onLoadMore)
  });

  // Load products if none are provided initially
  useEffect(() => {
    // Use cache to prevent duplicate loading
    if (products.length === 0 && !cache.isLoadingProducts()) {
      // Check if we already have cached products
      if (cache.hasLoadedProducts()) {
        const cachedProducts = cache.getProducts();
        console.log('🔄 ProductsList: Using cached products:', cachedProducts.length);
        setProducts(cachedProducts);
        return;
      }

      console.log('🔄 ProductsList: Loading initial products...');
      cache.setLoading(true);
      
      const loadInitialProducts = async () => {
        try {
          const tokens = await SecureStorage.getMLTokens();
          if (!tokens || await SecureStorage.isMLTokenExpired()) {
            throw new Error('Token de acesso não encontrado ou expirado. Conecte-se novamente ao Mercado Livre.');
          }

          const { data, error } = await supabase.functions.invoke('mercadolivre-products', {
            body: { 
              accessToken: tokens.accessToken,
              limit: 50,
              offset: 0
            }
          });

          if (error) throw error;

          console.log('✅ ProductsList: Initial products loaded:', data.products.length);
          cache.setProducts(data.products);
          setProducts(data.products);

          // Update parent component with pagination data
          if (onLoadMore && data.pagination) {
            onLoadMore(data.products, data.pagination);
          }

          toast({
            title: "📦 Produtos carregados!",
            description: `${data.products.length} produtos importados do Mercado Livre`,
          });

          // Calcular fretes automaticamente com CEP padrão
          calculateInitialFreights(data.products);

        } catch (error: any) {
          console.error('❌ Error loading initial products:', error);
          toast({
            title: "❌ Erro ao carregar produtos",
            description: error.message,
            variant: "destructive"
          });
        } finally {
          cache.setLoading(false);
        }
      };

      loadInitialProducts();
    }
  }, []);

  // Função para calcular fretes automaticamente na primeira carga
  const calculateInitialFreights = async (loadedProducts: Product[]) => {
    console.log('🚚 Iniciando cálculo automático de fretes com CEP padrão:', DEFAULT_SENDER_ZIP);
    setAutoCalculatingFreights(true);
    
    try {
      // Filtrar produtos que ainda não têm frete calculado
      const productsWithoutFreight = loadedProducts.filter(p => !p.freightCost && !p.sellerFreightCost);
      
      if (productsWithoutFreight.length === 0) {
        console.log('✅ Todos os produtos já têm frete calculado');
        return;
      }

      toast({
        title: "🚚 Calculando fretes automaticamente",
        description: `Calculando frete para ${productsWithoutFreight.length} produtos com CEP padrão (${DEFAULT_SENDER_ZIP})`,
      });

      // Calcular fretes em paralelo (máximo 3 por vez para não sobrecarregar)
      const batchSize = 3;
      for (let i = 0; i < productsWithoutFreight.length; i += batchSize) {
        const batch = productsWithoutFreight.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (product) => {
            try {
              const result = await fetchFreightCosts(product.id, DEFAULT_SENDER_ZIP);
              if (result) {
                handleFreightCalculated(product.id, result);
              }
            } catch (error) {
              console.error(`Erro ao calcular frete para produto ${product.id}:`, error);
            }
          })
        );

        // Pequeno delay entre batches
        if (i + batchSize < productsWithoutFreight.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      toast({
        title: "✅ Fretes calculados!",
        description: `Fretes calculados automaticamente para produtos com CEP ${DEFAULT_SENDER_ZIP}`,
      });

    } catch (error: any) {
      console.error('Erro no cálculo automático de fretes:', error);
      toast({
        title: "⚠️ Erro no cálculo automático",
        description: "Alguns fretes podem não ter sido calculados. Use o botão atualizar.",
        variant: "destructive"
      });
    } finally {
      setAutoCalculatingFreights(false);
    }
  };

  // Função para recalcular todos os fretes
  const refreshAllFreights = async () => {
    console.log('🔄 Recalculando todos os fretes...');
    setRefreshingFreights(true);
    
    try {
      toast({
        title: "🔄 Recalculando fretes",
        description: `Atualizando custos de frete para ${products.length} produtos`,
      });

      // Calcular fretes em paralelo (máximo 3 por vez)
      const batchSize = 3;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (product) => {
            try {
              const result = await fetchFreightCosts(product.id, DEFAULT_SENDER_ZIP);
              if (result) {
                handleFreightCalculated(product.id, result);
              }
            } catch (error) {
              console.error(`Erro ao recalcular frete para produto ${product.id}:`, error);
            }
          })
        );

        // Pequeno delay entre batches
        if (i + batchSize < products.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      toast({
        title: "✅ Fretes atualizados!",
        description: "Todos os fretes foram recalculados com sucesso",
      });

    } catch (error: any) {
      console.error('Erro ao recalcular fretes:', error);
      toast({
        title: "❌ Erro ao atualizar fretes",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setRefreshingFreights(false);
    }
  };

  const loadMoreProducts = async (limit: number) => {
    if (!pagination || !onLoadMore) {
      console.log('Cannot load more - missing pagination or onLoadMore');
      return;
    }
    
    console.log('Loading more products:', { limit, currentCount: products.length, pagination });
    
    setLoadingMore(true);
    try {
      const tokens = await SecureStorage.getMLTokens();
      if (!tokens || await SecureStorage.isMLTokenExpired()) {
        throw new Error('Token de acesso não encontrado ou expirado. Conecte-se novamente ao Mercado Livre.');
      }

      const { data, error } = await supabase.functions.invoke('mercadolivre-products', {
        body: { 
          accessToken: tokens.accessToken,
          limit,
          offset: products.length
        }
      });

      if (error) throw error;

      console.log('Loaded new products:', data.products.length);

      const newProducts = [...products, ...data.products];
      setProducts(newProducts);
      onLoadMore(newProducts, data.pagination);

      toast({
        title: "✅ Produtos carregados!",
        description: `${data.products.length} novos produtos foram adicionados`,
      });

    } catch (error: any) {
      console.error('Error loading more products:', error);
      toast({
        title: "❌ Erro ao carregar produtos",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const loadAllProducts = async () => {
    if (!pagination || !onLoadMore) {
      console.log('Cannot load all - missing pagination or onLoadMore');
      return;
    }
    
    console.log('Loading ALL products');
    
    setLoadingMore(true);
    try {
      const tokens = await SecureStorage.getMLTokens();
      if (!tokens || await SecureStorage.isMLTokenExpired()) {
        throw new Error('Token de acesso não encontrado ou expirado. Conecte-se novamente ao Mercado Livre.');
      }

      const { data, error } = await supabase.functions.invoke('mercadolivre-products', {
        body: { 
          accessToken: tokens.accessToken,
          limit: -1,
          offset: 0
        }
      });

      if (error) throw error;

      console.log('Loaded ALL products:', data.products.length);

      setProducts(data.products);
      onLoadMore(data.products, data.pagination);

      toast({
        title: "✅ Todos os produtos carregados!",
        description: `Total de ${data.products.length} produtos importados`,
      });

    } catch (error: any) {
      console.error('Error loading all products:', error);
      toast({
        title: "❌ Erro ao carregar todos os produtos",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const adjustPrice = (productId: string, operation: 'add' | 'subtract') => {
    setProducts(prev => prev.map(product => {
      if (product.id === productId) {
        const freightCost = product.sellerFreightCost;
        if (!freightCost) {
          toast({
            title: "Calcule o frete primeiro",
            description: "É necessário calcular o custo real do frete antes de ajustar o preço",
            variant: "destructive"
          });
          return product;
        }
        
        const adjustment = operation === 'add' ? freightCost : -freightCost;
        return {
          ...product,
          adjustedPrice: product.originalPrice + adjustment
        };
      }
      return product;
    }));

    toast({
      title: "Preço ajustado!",
      description: `Custo real do frete ${operation === 'add' ? 'adicionado ao' : 'subtraído do'} preço`,
    });
  };

  const adjustAllPrices = (operation: 'add' | 'subtract') => {
    let adjustedCount = 0;
    
    setProducts(prev => prev.map(product => {
      if (product.freeShipping && product.sellerFreightCost) {
        const adjustment = operation === 'add' ? product.sellerFreightCost : -product.sellerFreightCost;
        adjustedCount++;
        return {
          ...product,
          adjustedPrice: product.originalPrice + adjustment
        };
      }
      return product;
    }));

    if (adjustedCount === 0) {
      toast({
        title: "Nenhum produto ajustado",
        description: "Calcule o custo real do frete primeiro para produtos com frete grátis",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Preços ajustados em massa!",
        description: `${adjustedCount} produtos com frete grátis foram ajustados com o custo real do vendedor`,
      });
    }
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

  if (products.length === 0) {
    return (
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-8 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto encontrado</h3>
          <p className="text-gray-600">
            Não foi possível encontrar produtos ativos em sua conta do Mercado Livre.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Debug Information */}
      {pagination && (
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          Debug: Total: {pagination.total}, Loaded: {products.length}, HasMore: {pagination.hasMore ? 'Yes' : 'No'}, OnLoadMore: {onLoadMore ? 'Yes' : 'No'}
        </div>
      )}

      {/* Freight Info & Actions */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-800 mb-1">
                📍 Fretes calculados automaticamente
              </h3>
              <p className="text-sm text-green-700">
                CEP padrão do remetente: <strong>{DEFAULT_SENDER_ZIP}</strong> (São Paulo - SP)
                <br />
                {autoCalculatingFreights && "🔄 Calculando fretes iniciais..."}
                {refreshingFreights && "🔄 Atualizando todos os fretes..."}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={refreshAllFreights}
                disabled={refreshingFreights || autoCalculatingFreights}
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshingFreights ? 'animate-spin' : ''}`} />
                {refreshingFreights ? 'Atualizando...' : 'Atualizar Fretes'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Freight Calculator */}
      <FreightCalculator
        products={products}
        onFreightCalculated={handleFreightCalculated}
        loadingFreight={loadingFreight}
        setLoadingFreight={setLoadingFreight}
        initialZipCode={DEFAULT_SENDER_ZIP}
      />

      {/* Action Buttons */}
      <ProductActions
        products={products}
        onAdjustAllPrices={adjustAllPrices}
      />

      {/* Shipping Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={shippingFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setShippingFilter('all')}
          size="sm"
        >
          <Package className="w-4 h-4 mr-2" />
          Todos os produtos
        </Button>
        <Button
          variant={shippingFilter === 'free' ? 'default' : 'outline'}
          onClick={() => setShippingFilter('free')}
          size="sm"
        >
          <Truck className="w-4 h-4 mr-2" />
          Com frete grátis
        </Button>
        <Button
          variant={shippingFilter === 'paid' ? 'default' : 'outline'}
          onClick={() => setShippingFilter('paid')}
          size="sm"
        >
          <X className="w-4 h-4 mr-2" />
          Sem frete grátis
        </Button>
      </div>

      {/* Products Grid */}
      <div className="grid gap-4">
        {products
          .filter(product => {
            if (shippingFilter === 'free') return product.freeShipping;
            if (shippingFilter === 'paid') return !product.freeShipping;
            return true;
          })
          .map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onCalculateFreight={(productId) => {
              toast({
                title: "Use a calculadora principal",
                description: "Use a calculadora de frete acima para calcular o custo de todos os produtos",
                variant: "destructive"
              });
            }}
            onAdjustPrice={adjustPrice}
            loadingFreight={loadingFreight[product.id] || false}
            zipCode=""
          />
        ))}
      </div>

      {/* Pagination Controls - Show at bottom too when there are more products to load */}
      {pagination && pagination.hasMore && onLoadMore && (
        <ProductsPagination
          pagination={pagination}
          onLoadMore={loadMoreProducts}
          onLoadAll={loadAllProducts}
          loading={loadingMore}
          currentProductsCount={products.length}
        />
      )}
    </div>
  );
};
