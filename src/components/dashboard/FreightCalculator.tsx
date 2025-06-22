
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Calculator, Truck, RefreshCw, Bug, Trash2, Eye } from "lucide-react";
import { Product } from './types';
import { useFreightChangeDetection } from '@/hooks/useFreightChangeDetection';
import { FreightDebugger } from '@/utils/freightDebug';

interface FreightCalculatorProps {
  products: Product[];
  onFreightCalculated: (productId: string, freightData: {
    freightCost: number;
    sellerFreightCost: number;
    freightMethod: string;
  }) => void;
  loadingFreight: Record<string, boolean>;
  setLoadingFreight: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

// Standard ZIP code for São Paulo center (sender location)
const STANDARD_ZIP_CODE = '01310-100';

export const FreightCalculator = ({ 
  products, 
  onFreightCalculated, 
  loadingFreight, 
  setLoadingFreight 
}: FreightCalculatorProps) => {
  const [debugMode, setDebugMode] = useState(false);
  const { checkForChanges, markItemAsChanged, hasItemChanged, changedItemsCount } = useFreightChangeDetection();

  const getFreightCache = () => {
    return JSON.parse(localStorage.getItem('freight_calculations') || '{}');
  };

  const setFreightCache = (cache: any) => {
    localStorage.setItem('freight_calculations', JSON.stringify(cache));
  };

  const fetchFreightCosts = async (productId: string, forceRecalculate = false) => {
    const calculationCache = getFreightCache();
    const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
    
    // Check if we have a recent calculation and don't need to force recalculate
    if (!forceRecalculate) {
      const cachedCalculation = calculationCache[productId];
      if (cachedCalculation && cachedCalculation.timestamp > fortyEightHoursAgo) {
        const cacheAge = Date.now() - cachedCalculation.timestamp;
        
        console.log(`📋 Usando cálculo em cache para produto ${productId}`);
        
        // Log debug info for cache usage
        FreightDebugger.logFreightCalculation({
          productId,
          value: cachedCalculation.sellerFreightCost,
          source: 'cache',
          timestamp: cachedCalculation.timestamp,
          cacheAge,
          calculationMethod: cachedCalculation.freightMethod,
          rawData: cachedCalculation
        });
        
        onFreightCalculated(productId, {
          freightCost: cachedCalculation.freightCost,
          sellerFreightCost: cachedCalculation.sellerFreightCost,
          freightMethod: cachedCalculation.freightMethod
        });
        
        const hoursAgo = Math.round(cacheAge / (1000 * 60 * 60));
        toast({
          title: "📋 Valor em cache",
          description: `Usando cálculo salvo (${hoursAgo}h atrás) - R$ ${cachedCalculation.sellerFreightCost.toFixed(2)}`,
        });
        return;
      }
    }

    setLoadingFreight(prev => ({ ...prev, [productId]: true }));

    try {
      console.log('🚚 CALCULANDO CUSTO REAL DE FRETE VIA API');
      console.log('📍 Produto ID:', productId);
      console.log('📍 CEP padrão (remetente):', STANDARD_ZIP_CODE);
      
      const accessToken = localStorage.getItem('ml_access_token');
      if (!accessToken) {
        throw new Error('Token de acesso não encontrado. Reconecte-se ao Mercado Livre.');
      }

      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke('mercadolivre-freight', {
        body: { 
          action: 'getShippingCosts',
          productId,
          zipCode: STANDARD_ZIP_CODE,
          accessToken
        }
      });

      if (error) {
        console.error('❌ ERRO DA FUNÇÃO SUPABASE:', error);
        throw new Error(`Erro da API: ${error.message}`);
      }

      console.log('📦 RESPOSTA COMPLETA DA API:', JSON.stringify(data, null, 2));
      
      const selectedOption = data?.selectedOption || data?.freightOptions?.[0];
      
      if (!selectedOption) {
        console.error('❌ NENHUMA OPÇÃO VÁLIDA DE FRETE RETORNADA');
        throw new Error('API do Mercado Livre não retornou opções de frete válidas');
      }

      const finalCustomerCost = Number(selectedOption.price);
      const finalSellerCost = Number(selectedOption.sellerCost);

      console.log('💰 VALORES FINAIS CALCULADOS:');
      console.log('- Custo para cliente:', finalCustomerCost);
      console.log('- Custo para vendedor:', finalSellerCost);
      console.log('- Método:', selectedOption.method);
      console.log('- Dados brutos:', selectedOption.rawData);

      // Log debug info for API calculation
      FreightDebugger.logFreightCalculation({
        productId,
        value: finalSellerCost,
        source: 'api',
        timestamp: Date.now(),
        calculationMethod: selectedOption.method,
        apiResponse: data,
        rawData: selectedOption
      });

      onFreightCalculated(productId, {
        freightCost: finalCustomerCost,
        sellerFreightCost: finalSellerCost,
        freightMethod: selectedOption.method
      });

      // Update cache with timestamp
      calculationCache[productId] = {
        freightCost: finalCustomerCost,
        sellerFreightCost: finalSellerCost,
        freightMethod: selectedOption.method,
        timestamp: Date.now(),
        zipCode: STANDARD_ZIP_CODE
      };
      setFreightCache(calculationCache);

      const discountInfo = selectedOption.discount ? ` (desconto: ${JSON.stringify(selectedOption.discount)})` : '';
      
      toast({
        title: "✅ Custo calculado via API e salvo!",
        description: `${selectedOption.method}: Cliente R$ ${finalCustomerCost.toFixed(2)} | Vendedor R$ ${finalSellerCost.toFixed(2)}${discountInfo}`,
      });

    } catch (error: any) {
      console.error('💥 ERRO NO CÁLCULO:', error);
      
      toast({
        title: "❌ Erro ao calcular frete",
        description: `Erro: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoadingFreight(prev => ({ ...prev, [productId]: false }));
    }
  };

  const calculateAllFreights = async (forceRecalculate = false) => {
    await checkForChanges();
    
    for (const product of products) {
      if (!loadingFreight[product.id]) {
        await fetchFreightCosts(product.id, forceRecalculate);
        // Small delay to avoid API rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  const clearAllCache = () => {
    localStorage.removeItem('freight_calculations');
    FreightDebugger.clearDebugLog();
    toast({
      title: "🧹 Cache limpo",
      description: "Todo o cache de fretes foi removido",
    });
  };

  const inspectCache = () => {
    FreightDebugger.inspectFreightCache();
    const cache = FreightDebugger.getDebugLog();
    console.log('🔍 DEBUG LOG COMPLETO:', cache);
    
    toast({
      title: "🔍 Inspeção realizada",
      description: "Verifique o console para detalhes do cache",
    });
  };

  const recalculateAll = () => {
    calculateAllFreights(true);
  };

  const hasAnyLoading = Object.values(loadingFreight).some(Boolean);

  return (
    <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Calculator className="h-5 w-5" />
          Calculadora de Frete Real
          {changedItemsCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {changedItemsCount} alterados
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-blue-100">
            Calcule o custo real do frete que você paga como vendedor
            <br />
            <span className="text-sm opacity-75">CEP padrão: {STANDARD_ZIP_CODE} (valores salvos por 48h)</span>
          </p>
          
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => calculateAllFreights(false)}
              disabled={hasAnyLoading}
              className="flex items-center gap-2 bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm"
            >
              <Truck className="h-4 w-4" />
              {hasAnyLoading ? 'Calculando...' : 'Calcular (Cache)'}
            </Button>
            
            <Button
              onClick={recalculateAll}
              disabled={hasAnyLoading}
              variant="outline"
              className="flex items-center gap-2 border-white/30 text-white hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" />
              Recalcular Tudo
            </Button>

            <Button
              onClick={() => setDebugMode(!debugMode)}
              variant="outline"
              className="flex items-center gap-2 border-white/30 text-white hover:bg-white/10"
            >
              <Bug className="h-4 w-4" />
              Debug {debugMode ? 'ON' : 'OFF'}
            </Button>
          </div>

          {debugMode && (
            <div className="bg-black/20 p-4 rounded-lg space-y-2">
              <h3 className="font-semibold text-white">🔍 Ferramentas de Debug</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={inspectCache}
                  size="sm"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Inspecionar Cache
                </Button>
                
                <Button
                  onClick={clearAllCache}
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-200 hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Limpar Todo Cache
                </Button>
              </div>
              
              <p className="text-xs text-white/70">
                Use as ferramentas acima para investigar de onde vêm os valores de frete.
                Todos os logs aparecem no console do navegador.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
