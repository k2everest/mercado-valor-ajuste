import { useState, useCallback, useMemo } from 'react';
import { Product } from '@/components/dashboard/types';
import { supabase } from '@/integrations/supabase/client';
import { SecureStorage } from '@/utils/secureStorage';
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
  const getValidMLToken = useCallback(async (): Promise<string | null> => {
    const tokens = SecureStorage.getMLTokens();
    
    if (!tokens) {
      console.log('❌ Nenhum token encontrado');
      return null;
    }

    // Check if token is expired
    if (SecureStorage.isMLTokenExpired()) {
      console.log('⏰ Token expirado, tentando renovar...');
      
      try {
        const { data, error } = await supabase.functions.invoke('mercadolivre-refresh-token', {
          body: { refreshToken: tokens.refreshToken }
        });

        if (error) {
          console.error('❌ Erro ao renovar token:', error);
          SecureStorage.removeSecureItem('ml_tokens');
          return null;
        }

        // Save new tokens
        SecureStorage.setMLTokens(
          data.accessToken,
          data.refreshToken || tokens.refreshToken,
          data.expiresIn || 21600
        );

        console.log('✅ Token renovado com sucesso');
        return data.accessToken;
      } catch (error: any) {
        console.error('💥 Erro ao renovar token:', error);
        SecureStorage.removeSecureItem('ml_tokens');
        return null;
      }
    }

    return tokens.accessToken;
  }, []);
  
  const loadProductsWithRetry = useCallback(async (limit: number = 50, offset: number = 0) => {
    try {
      let accessToken = await getValidMLToken();
      if (!accessToken) {
        throw new Error('Token de acesso não disponível. Reconecte-se ao Mercado Livre.');
      }

      console.log(`🔄 Carregando produtos... (limit: ${limit}, offset: ${offset})`);

      const { data, error } = await supabase.functions.invoke('mercadolivre-products', {
        body: { accessToken, limit, offset }
      });

      if (error) {
        // If it's an auth error, force token refresh and retry
        if (error.message?.includes('INVALID_TOKEN') || error.message?.includes('unauthorized') || error.message?.includes('invalid access token')) {
          console.log('🔄 Token inválido, forçando renovação...');
          
          // Clear current token and force refresh
          SecureStorage.removeSecureItem('ml_tokens');
          
          // Try to get fresh token
          accessToken = await getValidMLToken();
          if (accessToken) {
            console.log('🔄 Tentando novamente com token renovado...');
            // Retry with new token
            const retryResponse = await supabase.functions.invoke('mercadolivre-products', {
              body: { accessToken, limit, offset }
            });
            
            if (retryResponse.error) {
              throw new Error(retryResponse.error.message || 'Falha ao carregar produtos após renovação do token');
            }
            return retryResponse.data;
          } else {
            throw new Error('Não foi possível renovar o token. Reconecte-se ao Mercado Livre.');
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