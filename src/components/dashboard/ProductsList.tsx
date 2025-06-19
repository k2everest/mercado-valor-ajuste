import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ProductsPagination } from "./ProductsPagination";
import { FreightCalculator } from "./FreightCalculator";
import { ProductActions } from "./ProductActions";
import { ProductCard } from "./ProductCard";
import { Package } from "lucide-react";
import { Product, ProductsListProps } from './types';

export const ProductsList = ({ products: initialProducts, pagination, onLoadMore }: ProductsListProps) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loadingFreight, setLoadingFreight] = useState<Record<string, boolean>>({});
  const [loadingMore, setLoadingMore] = useState(false);

  console.log('ProductsList rendered with:', {
    productsCount: products.length,
    pagination,
    hasOnLoadMore: !!onLoadMore,
    hasMore: pagination?.hasMore,
    paginationTotal: pagination?.total,
    showPagination: !!(pagination && pagination.hasMore && onLoadMore)
  });

  const loadMoreProducts = async (limit: number) => {
    if (!pagination || !onLoadMore) {
      console.log('Cannot load more - missing pagination or onLoadMore');
      return;
    }
    
    console.log('Loading more products:', { limit, currentCount: products.length, pagination });
    
    setLoadingMore(true);
    try {
      const accessToken = localStorage.getItem('ml_access_token');
      if (!accessToken) {
        throw new Error('Token de acesso não encontrado');
      }

      const { data, error } = await supabase.functions.invoke('mercadolivre-products', {
        body: { 
          accessToken,
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
      const accessToken = localStorage.getItem('ml_access_token');
      if (!accessToken) {
        throw new Error('Token de acesso não encontrado');
      }

      const { data, error } = await supabase.functions.invoke('mercadolivre-products', {
        body: { 
          accessToken,
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

  // Check if we should show pagination - make this more explicit
  const shouldShowPagination = pagination && pagination.hasMore && onLoadMore;

  return (
    <div className="space-y-6">
      {/* Debug Information */}
      {pagination && (
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          Debug: Total: {pagination.total}, Loaded: {products.length}, HasMore: {pagination.hasMore ? 'Yes' : 'No'}, OnLoadMore: {onLoadMore ? 'Yes' : 'No'}, ShouldShow: {shouldShowPagination ? 'Yes' : 'No'}
        </div>
      )}

      {/* Freight Calculator */}
      <FreightCalculator
        products={products}
        onFreightCalculated={handleFreightCalculated}
        loadingFreight={loadingFreight}
        setLoadingFreight={setLoadingFreight}
      />

      {/* Action Buttons */}
      <ProductActions
        products={products}
        onAdjustAllPrices={adjustAllPrices}
      />

      {/* Pagination Controls - Show at top when there are more products to load */}
      {shouldShowPagination && (
        <ProductsPagination
          pagination={pagination}
          onLoadMore={loadMoreProducts}
          onLoadAll={loadAllProducts}
          loading={loadingMore}
          currentProductsCount={products.length}
        />
      )}

      {/* Products Grid */}
      <div className="grid gap-4">
        {products.map((product) => (
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
      {shouldShowPagination && (
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
