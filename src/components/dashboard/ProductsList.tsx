
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SecureStorage } from "@/utils/secureStorage";
import { ProductsPagination } from "./ProductsPagination";
import { FreightCalculator } from "./FreightCalculator";
import { ProductActions } from "./ProductActions";
import { ProductCard } from "./ProductCard";
import { Package, Truck, X, RefreshCw, Upload, CheckSquare } from "lucide-react";
import { Product, ProductsListProps } from './types';
import { useFreightCalculation } from "@/hooks/useFreightCalculation";
import { useFreightPersistence } from "@/hooks/useFreightPersistence";

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
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [sendingPrices, setSendingPrices] = useState(false);
  const [sendingAdjustedPrices, setSendingAdjustedPrices] = useState(false);
  const [currentZipCode, setCurrentZipCode] = useState<string>('');
  
  // CEP da Rua Dr. Dolzani 677, Jardim da Glória, São Paulo - SP
  const DEFAULT_SENDER_ZIP = '01546-000';
  
  const cache = ProductsCache.getInstance();
  const { fetchFreightCosts } = useFreightCalculation();
  const { lastZipCode, loadLastCalculations, saveCalculations } = useFreightPersistence();

  console.log('ProductsList rendered with:', {
    productsCount: products.length,
    pagination,
    hasOnLoadMore: !!onLoadMore,
    hasMore: pagination?.hasMore,
    paginationTotal: pagination?.total,
    showPagination: !!(pagination && pagination.hasMore && onLoadMore)
  });

  // Carregar dados da última sessão ao montar
  useEffect(() => {
    const loadLastSession = async () => {
      console.log('🔄 Carregando dados da última sessão...');
      const lastCalculations = await loadLastCalculations();
      
      if (lastCalculations.length > 0) {
        console.log('✅ Dados anteriores carregados:', lastCalculations.length, 'produtos');
        toast({
          title: "📋 Sessão anterior restaurada",
          description: `${lastCalculations.length} produtos com cálculos anteriores carregados`,
        });
        
        // Mesclar com produtos atuais se houver
        if (products.length > 0) {
          const mergedProducts = products.map(current => {
            const saved = lastCalculations.find(p => p.id === current.id);
            return saved ? { ...current, ...saved } : current;
          });
          setProducts(mergedProducts);
          cache.setProducts(mergedProducts);
        } else {
          setProducts(lastCalculations);
          cache.setProducts(lastCalculations);
        }
      }
      
      // Definir CEP da última sessão
      if (lastZipCode) {
        console.log('📍 CEP da sessão anterior:', lastZipCode);
        setCurrentZipCode(lastZipCode);
      } else {
        setCurrentZipCode(DEFAULT_SENDER_ZIP);
      }
    };
    
    loadLastSession();
  }, [lastZipCode]);

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

          // Calcular fretes automaticamente com CEP padrão ou último usado
          const zipToUse = lastZipCode || DEFAULT_SENDER_ZIP;
          calculateInitialFreights(data.products, zipToUse);

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
  }, [lastZipCode]);

  // Função para calcular fretes automaticamente na primeira carga
  const calculateInitialFreights = async (loadedProducts: Product[], zipCode: string) => {
    console.log('🚚 Iniciando cálculo automático de fretes com CEP:', zipCode);
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
        description: `Calculando frete para ${productsWithoutFreight.length} produtos com CEP ${zipCode}`,
      });

      // Calcular fretes em paralelo (máximo 3 por vez para não sobrecarregar)
      const batchSize = 3;
      for (let i = 0; i < productsWithoutFreight.length; i += batchSize) {
        const batch = productsWithoutFreight.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (product) => {
            try {
              const result = await fetchFreightCosts(product.id, zipCode);
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
        description: `Fretes calculados automaticamente para produtos com CEP ${zipCode}`,
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
    setProducts(prev => {
      const updated = prev.map(product => {
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
      });
      
      // Salvar ajustes
      const zipToSave = currentZipCode || DEFAULT_SENDER_ZIP;
      saveCalculations(updated, zipToSave);
      
      return updated;
    });

    toast({
      title: "Preço ajustado!",
      description: `Custo real do frete ${operation === 'add' ? 'adicionado ao' : 'subtraído do'} preço`,
    });
  };

  const adjustAllPrices = (operation: 'add' | 'subtract') => {
    let adjustedCount = 0;
    
    setProducts(prev => {
      const updated = prev.map(product => {
        if (product.freeShipping && product.sellerFreightCost) {
          const adjustment = operation === 'add' ? product.sellerFreightCost : -product.sellerFreightCost;
          adjustedCount++;
          return {
            ...product,
            adjustedPrice: product.originalPrice + adjustment
          };
        }
        return product;
      });
      
      // Salvar ajustes em massa
      if (adjustedCount > 0) {
        const zipToSave = currentZipCode || DEFAULT_SENDER_ZIP;
        saveCalculations(updated, zipToSave);
      }
      
      return updated;
    });

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
    setProducts(prev => {
      const updated = prev.map(product => {
        if (product.id === productId) {
          return {
            ...product,
            ...freightData,
            adjustedPrice: undefined
          };
        }
        return product;
      });
      
      // Salvar cálculos atualizados
      const zipToSave = currentZipCode || DEFAULT_SENDER_ZIP;
      saveCalculations(updated, zipToSave);
      
      return updated;
    });
  };

  const toggleSelectAll = () => {
    const filteredProducts = products.filter(product => {
      if (shippingFilter === 'free') return product.freeShipping;
      if (shippingFilter === 'paid') return !product.freeShipping;
      return true;
    });

    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const toggleSelectProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const sendAdjustedFreeShippingPricesToML = async () => {
    // Filter products with free shipping that have been adjusted
    const adjustedFreeShippingProducts = products.filter(
      p => p.freeShipping && p.adjustedPrice && p.adjustedPrice !== p.originalPrice
    );
    
    if (adjustedFreeShippingProducts.length === 0) {
      toast({
        title: "❌ Nenhum produto elegível",
        description: "Nenhum produto com frete grátis foi reajustado ainda",
        variant: "destructive"
      });
      return;
    }

    setSendingAdjustedPrices(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const mlTokenStr = localStorage.getItem('ml_token');
      if (!mlTokenStr) {
        throw new Error('Token do Mercado Livre não encontrado. Reconecte sua conta.');
      }

      const mlToken = JSON.parse(mlTokenStr);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      toast({
        title: "📤 Enviando preços ajustados",
        description: `Atualizando ${adjustedFreeShippingProducts.length} produtos com frete grátis no Mercado Livre...`,
      });

      for (const product of adjustedFreeShippingProducts) {
        try {
          const { data, error } = await supabase.functions.invoke('mercadolivre-update-price', {
            body: {
              productId: product.id,
              newPrice: product.adjustedPrice,
              accessToken: mlToken.access_token
            }
          });

          if (error) throw error;
          if (!data.success) throw new Error(data.error);

          // Check if this is the first update for this product
          const { data: existingUpdates } = await supabase
            .from('price_updates_history')
            .select('id')
            .eq('product_id', product.id)
            .limit(1);

          const isFirstUpdate = !existingUpdates || existingUpdates.length === 0;

          // Calculate new base price: adjusted price - freight cost
          const newBasePrice = product.adjustedPrice! - (product.sellerFreightCost || 0);
          
          // Determine operation (add or subtract)
          const operation = product.adjustedPrice! > product.originalPrice ? 'add' : 'subtract';

          // Save to history
          const historyRecord = {
            user_id: user.id,
            product_id: product.id,
            product_title: product.title,
            original_price: product.originalPrice,
            freight_cost: product.sellerFreightCost || 0,
            adjusted_price: product.adjustedPrice!,
            new_base_price: newBasePrice,
            operation: operation,
            is_first_update: isFirstUpdate
          };

          const { error: historyError } = await supabase
            .from('price_updates_history')
            .insert(historyRecord);

          if (historyError) {
            console.error('Erro ao salvar histórico do produto', product.id, ':', historyError);
          }

          successCount++;
        } catch (error) {
          console.error(`Erro ao atualizar produto ${product.id}:`, error);
          errorCount++;
        }

        // Pequeno delay entre requisições
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (successCount > 0) {
        toast({
          title: "✅ Preços enviados com sucesso!",
          description: `${successCount} produto(s) com frete grátis atualizado(s)${errorCount > 0 ? `. ${errorCount} erro(s).` : ''}`,
        });
      }

      if (errorCount > 0 && successCount === 0) {
        toast({
          title: "❌ Erro ao atualizar preços",
          description: `Falha ao atualizar ${errorCount} produto(s)`,
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('Erro ao enviar preços ajustados:', error);
      toast({
        title: "❌ Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSendingAdjustedPrices(false);
    }
  };

  const sendSelectedPricesToML = async () => {
    const selectedProductsList = products.filter(p => selectedProducts.has(p.id) && p.adjustedPrice);
    
    if (selectedProductsList.length === 0) {
      toast({
        title: "❌ Nenhum produto selecionado",
        description: "Selecione produtos com preço ajustado para enviar",
        variant: "destructive"
      });
      return;
    }

    setSendingPrices(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const mlTokenStr = localStorage.getItem('ml_token');
      if (!mlTokenStr) {
        throw new Error('Token do Mercado Livre não encontrado. Reconecte sua conta.');
      }

      const mlToken = JSON.parse(mlTokenStr);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      toast({
        title: "📤 Enviando preços",
        description: `Atualizando ${selectedProductsList.length} produtos no Mercado Livre...`,
      });

      for (const product of selectedProductsList) {
        try {
          const { data, error } = await supabase.functions.invoke('mercadolivre-update-price', {
            body: {
              productId: product.id,
              newPrice: product.adjustedPrice,
              accessToken: mlToken.access_token
            }
          });

          if (error) throw error;
          if (!data.success) throw new Error(data.error);

          // Check if this is the first update for this product
          const { data: existingUpdates } = await supabase
            .from('price_updates_history')
            .select('id')
            .eq('product_id', product.id)
            .limit(1);

          const isFirstUpdate = !existingUpdates || existingUpdates.length === 0;

          // Calculate new base price: adjusted price - freight cost
          const newBasePrice = product.adjustedPrice! - (product.sellerFreightCost || 0);
          
          // Determine operation (add or subtract)
          const operation = product.adjustedPrice! > product.originalPrice ? 'add' : 'subtract';

          // Save to history with properly typed object
          const historyRecord = {
            user_id: user.id,
            product_id: product.id,
            product_title: product.title,
            original_price: product.originalPrice,
            freight_cost: product.sellerFreightCost || 0,
            adjusted_price: product.adjustedPrice!,
            new_base_price: newBasePrice,
            operation: operation,
            is_first_update: isFirstUpdate
          };

          const { error: historyError } = await supabase
            .from('price_updates_history')
            .insert(historyRecord);

          if (historyError) {
            console.error('Erro ao salvar histórico do produto', product.id, ':', historyError);
          }

          successCount++;
        } catch (error) {
          console.error(`Erro ao atualizar produto ${product.id}:`, error);
          errorCount++;
        }

        // Pequeno delay entre requisições
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (successCount > 0) {
        toast({
          title: "✅ Preços atualizados!",
          description: `${successCount} produto(s) atualizado(s) com sucesso${errorCount > 0 ? `. ${errorCount} erro(s).` : ''}`,
        });
        
        // Limpar seleção após envio bem-sucedido
        setSelectedProducts(new Set());
      }

      if (errorCount > 0 && successCount === 0) {
        toast({
          title: "❌ Erro ao atualizar preços",
          description: `Falha ao atualizar ${errorCount} produto(s)`,
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('Erro ao enviar preços:', error);
      toast({
        title: "❌ Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSendingPrices(false);
    }
  };

  const filteredProducts = products.filter(product => {
    if (shippingFilter === 'free') return product.freeShipping;
    if (shippingFilter === 'paid') return !product.freeShipping;
    return true;
  });

  const allFilteredSelected = filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length;

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
        initialZipCode={currentZipCode || DEFAULT_SENDER_ZIP}
        onZipCodeChange={setCurrentZipCode}
      />

      {/* Action Buttons */}
      <ProductActions
        products={products}
        onAdjustAllPrices={adjustAllPrices}
        onSendAdjustedPrices={sendAdjustedFreeShippingPricesToML}
        sendingPrices={sendingAdjustedPrices}
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

      {/* Selection Controls */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="select-all"
                checked={allFilteredSelected}
                onCheckedChange={toggleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Selecionar todos ({filteredProducts.length} produtos)
              </label>
              {selectedProducts.size > 0 && (
                <span className="text-sm text-purple-700 font-semibold">
                  {selectedProducts.size} selecionado(s)
                </span>
              )}
            </div>
            {selectedProducts.size > 0 && (
              <Button
                onClick={sendSelectedPricesToML}
                disabled={sendingPrices}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                {sendingPrices ? 'Enviando...' : `Enviar ${selectedProducts.size} Preço(s) ao ML`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      <div className="grid gap-4">
        {filteredProducts.map((product) => (
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
            isSelected={selectedProducts.has(product.id)}
            onToggleSelect={toggleSelectProduct}
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
