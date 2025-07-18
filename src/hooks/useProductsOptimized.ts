import { useState, useCallback, useMemo } from 'react';
import { Product } from '@/components/dashboard/types';
import { supabase } from '@/integrations/supabase/client';
import { useMercadoLibreAuth } from './useMercadoLibreAuth';
import { toast } from 'sonner';

export const useProductsOptimized = (initialProducts: Product[] = []) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);

  // Memoized product map for faster lookups
  const productMap = useMemo(() => {
    return products.reduce((map, product) => {
      map[product.id] = product;
      return map;
    }, {} as Record<string, Product>);
  }, [products]);

  // Memoized filtered products for different states
  const activeProducts = useMemo(() => 
    products.filter(p => p.status === 'active'),
    [products]
  );

  const freeShippingProducts = useMemo(() => 
    products.filter(p => p.freeShipping),
    [products]
  );

  const productsWithFreight = useMemo(() => 
    products.filter(p => p.sellerFreightCost !== undefined),
    [products]
  );

  // Optimized update functions
  const updateProduct = useCallback((productId: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, ...updates } : p
    ));
  }, []);

  const updateMultipleProducts = useCallback((updates: Record<string, Partial<Product>>) => {
    setProducts(prev => prev.map(p => 
      updates[p.id] ? { ...p, ...updates[p.id] } : p
    ));
  }, []);

  const addProducts = useCallback((newProducts: Product[]) => {
    setProducts(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const uniqueNewProducts = newProducts.filter(p => !existingIds.has(p.id));
      return [...prev, ...uniqueNewProducts];
    });
  }, []);

  const replaceProducts = useCallback((newProducts: Product[]) => {
    setProducts(newProducts);
  }, []);

  // Auto-retry product loading with token refresh
  const { getValidMLToken } = useMercadoLibreAuth();
  
  const loadProductsWithRetry = useCallback(async (limit: number = 50, offset: number = 0) => {
    try {
      const accessToken = await getValidMLToken();
      if (!accessToken) {
        throw new Error('Token de acesso não disponível. Reconecte-se ao Mercado Livre.');
      }

      console.log(`🔄 Carregando produtos... (limit: ${limit}, offset: ${offset})`);

      const { data, error } = await supabase.functions.invoke('mercadolivre-products', {
        body: { accessToken, limit, offset }
      });

      if (error) {
        // If it's an auth error, try refreshing token once more
        if (error.message?.includes('unauthorized') || error.message?.includes('invalid access token')) {
          console.log('🔄 Token inválido, tentando renovar...');
          const newToken = await getValidMLToken();
          if (newToken) {
            // Retry with new token
            const retryResponse = await supabase.functions.invoke('mercadolivre-products', {
              body: { accessToken: newToken, limit, offset }
            });
            
            if (retryResponse.error) {
              throw new Error(retryResponse.error.message || 'Falha ao carregar produtos após renovação do token');
            }
            return retryResponse.data;
          }
        }
        throw new Error(error.message || 'Erro ao carregar produtos');
      }

      return data;
    } catch (error: any) {
      console.error('💥 Erro ao carregar produtos:', error);
      toast.error(`Erro ao carregar produtos: ${error.message}`);
      throw error;
    }
  }, [getValidMLToken]);

  return {
    products,
    productMap,
    activeProducts,
    freeShippingProducts,
    productsWithFreight,
    updateProduct,
    updateMultipleProducts,
    addProducts,
    replaceProducts,
    setProducts,
    loadProductsWithRetry
  };
};