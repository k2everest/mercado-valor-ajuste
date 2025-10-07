
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Minus, Plus, Truck, Bug, Trash2, Upload } from "lucide-react";
import { Product } from './types';
import { FreightDebugger } from '@/utils/freightDebug';
import { toast } from "@/hooks/use-toast";
import { memo, useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProductCardProps {
  product: Product;
  onCalculateFreight: (productId: string) => void;
  onAdjustPrice: (productId: string, operation: 'add' | 'subtract') => void;
  loadingFreight: boolean;
  zipCode: string;
}

export const ProductCard = memo(({ 
  product, 
  onCalculateFreight, 
  onAdjustPrice, 
  loadingFreight, 
  zipCode 
}: ProductCardProps) => {
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const statusColor = useMemo(() => {
    switch (product.status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'paused': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'closed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }, [product.status]);

  const statusText = useMemo(() => {
    switch (product.status) {
      case 'active': return 'Ativo';
      case 'paused': return 'Pausado';
      case 'closed': return 'Finalizado';
      default: return product.status;
    }
  }, [product.status]);

  const debugProduct = useCallback(() => {
    console.log(`🔍 DEBUG PRODUTO ${product.id}:`);
    console.log('- Título:', product.title);
    console.log('- Preço original:', product.originalPrice);
    console.log('- Custo frete vendedor:', product.sellerFreightCost);
    console.log('- Método frete:', product.freightMethod);
    
    // Inspect cache for this product
    FreightDebugger.inspectProductCache(product.id);
    
    // Get debug info
    const debugInfo = FreightDebugger.getProductDebugInfo(product.id);
    if (debugInfo) {
      console.log('- Debug info:', debugInfo);
    }
    
    toast({
      title: "🔍 Debug realizado",
      description: `Informações do produto ${product.id} no console`,
    });
  }, [product.id]);

  const clearProductCache = useCallback(() => {
    FreightDebugger.clearProductCache(product.id);
    toast({
      title: "🧹 Cache limpo",
      description: `Cache do produto ${product.id} removido`,
    });
  }, [product.id]);

  const forceRecalculate = useCallback(() => {
    clearProductCache();
    onCalculateFreight(product.id);
  }, [clearProductCache, onCalculateFreight, product.id]);

  const updatePriceOnML = useCallback(async () => {
    if (!product.adjustedPrice) {
      toast({
        title: "❌ Erro",
        description: "Nenhum preço ajustado disponível. Ajuste o preço primeiro.",
        variant: "destructive"
      });
      return;
    }

    setIsUpdatingPrice(true);
    try {
      // Get ML token from localStorage
      const mlTokenStr = localStorage.getItem('ml_token');
      if (!mlTokenStr) {
        throw new Error('Token do Mercado Livre não encontrado. Reconecte sua conta.');
      }

      const mlToken = JSON.parse(mlTokenStr);
      
      console.log('📤 Enviando preço ajustado para o ML:', product.adjustedPrice);
      
      const { data, error } = await supabase.functions.invoke('mercadolivre-update-price', {
        body: {
          productId: product.id,
          newPrice: product.adjustedPrice,
          accessToken: mlToken.access_token
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: "✅ Preço atualizado!",
        description: `Preço de R$ ${product.originalPrice.toFixed(2)} atualizado para R$ ${product.adjustedPrice.toFixed(2)} no Mercado Livre`,
      });

    } catch (error: any) {
      console.error('❌ Erro ao atualizar preço:', error);
      toast({
        title: "❌ Erro ao atualizar preço",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUpdatingPrice(false);
    }
  }, [product.adjustedPrice, product.id, product.originalPrice]);

  // Get debug info to show source
  const debugInfo = useMemo(() => FreightDebugger.getProductDebugInfo(product.id), [product.id]);
  const valueSource = useMemo(() => debugInfo?.source || 'unknown', [debugInfo]);
  const cacheAge = useMemo(() => debugInfo?.cacheAge ? Math.round(debugInfo.cacheAge / (1000 * 60 * 60)) : null, [debugInfo]);

  return (
    <Card className="hover:shadow-lg transition-all duration-300 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-start gap-4">
              {product.thumbnail && (
                <img 
                  src={product.thumbnail} 
                  alt={product.title}
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0 border-2 border-blue-200"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg text-gray-900">{product.title}</h3>
                  {product.permalink && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="p-1 h-auto text-blue-600 hover:text-blue-800"
                    >
                      <a 
                        href={product.permalink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        title="Ver anúncio no Mercado Livre"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">Preço Original:</span>{' '}
                    <span className="text-lg font-bold text-blue-700">
                      R$ {product.originalPrice.toFixed(2)}
                    </span>
                  </div>
                  {product.sellerFreightCost !== undefined && (
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Custo Real do Frete ({product.freightMethod}):</span>{' '}
                      <span className="text-lg font-bold text-purple-700">
                        R$ {product.sellerFreightCost.toFixed(2)}
                      </span>
                      {product.freeShipping && (
                        <span className="text-xs text-orange-600 ml-1">(Vendedor paga)</span>
                      )}
                      {valueSource !== 'unknown' && (
                        <span className="text-xs text-gray-500 ml-2">
                          [{valueSource === 'cache' ? `cache ${cacheAge}h` : valueSource}]
                        </span>
                      )}
                    </div>
                  )}
                  {product.adjustedPrice && (
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Preço Ajustado:</span>{' '}
                      <span className="text-lg font-bold text-green-700">
                        R$ {product.adjustedPrice.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <Badge className={statusColor}>
                    {statusText}
                  </Badge>
                  {product.freeShipping && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                      ✅ Frete Grátis (Vendedor Paga)
                    </Badge>
                  )}
                  {product.availableQuantity !== undefined && (
                    <Badge variant="outline" className="border-purple-200 text-purple-700">
                      Disponível: {product.availableQuantity}
                    </Badge>
                  )}
                  {product.soldQuantity !== undefined && product.soldQuantity > 0 && (
                    <Badge variant="outline" className="border-green-200 text-green-700">
                      Vendidos: {product.soldQuantity}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCalculateFreight(product.id)}
              disabled={loadingFreight}
              className="flex items-center gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <Truck className="h-4 w-4" />
              {loadingFreight ? 'Calculando...' : 'Calcular Custo Real'}
            </Button>
            
            {product.sellerFreightCost !== undefined && (
              <>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAdjustPrice(product.id, 'subtract')}
                    className="flex items-center gap-1 border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    <Minus className="h-4 w-4" />
                    Subtrair Custo Real
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAdjustPrice(product.id, 'add')}
                    className="flex items-center gap-1 border-green-200 text-green-700 hover:bg-green-50"
                  >
                    <Plus className="h-4 w-4" />
                    Somar Custo Real
                  </Button>
                </div>
                
                {product.adjustedPrice && (
                  <Button
                    size="sm"
                    onClick={updatePriceOnML}
                    disabled={isUpdatingPrice}
                    className="flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Upload className="h-4 w-4" />
                    {isUpdatingPrice ? 'Enviando...' : 'Enviar Preço ao ML'}
                  </Button>
                )}
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={debugProduct}
                    className="flex items-center gap-1 border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    <Bug className="h-4 w-4" />
                    Debug
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={forceRecalculate}
                    disabled={loadingFreight}
                    className="flex items-center gap-1 border-orange-300 text-orange-600 hover:bg-orange-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Recalcular
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
