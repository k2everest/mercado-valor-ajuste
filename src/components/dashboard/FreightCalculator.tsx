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

  const makeMultipleFreightCalls = async (productId: string) => {
    const results = [];
    
    try {
      console.log('🚚 INICIANDO MÚLTIPLAS CHAMADAS PARA CONSENSO');
      console.log('📦 Produto:', productId);
      console.log('📍 CEP padrão:', STANDARD_ZIP_CODE);
      
      const accessToken = localStorage.getItem('ml_access_token');
      if (!accessToken) {
        throw new Error('Token de acesso não encontrado');
      }

      // Fazer 3 chamadas consecutivas
      for (let i = 1; i <= 3; i++) {
        console.log(`🔄 Chamada ${i}/3...`);
        
        try {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data, error } = await supabase.functions.invoke('mercadolivre-freight', {
            body: { 
              action: 'getShippingCosts',
              productId,
              zipCode: STANDARD_ZIP_CODE.replace(/\D/g, ''),
              accessToken
            }
          });

          if (error) {
            console.error(`❌ Erro na chamada ${i}:`, error);
            results.push({ attempt: i, success: false, error: error.message });
            continue;
          }

          const selectedOption = data?.selectedOption;
          if (!selectedOption) {
            console.error(`❌ Chamada ${i}: Nenhuma opção retornada`);
            results.push({ attempt: i, success: false, error: 'Nenhuma opção retornada' });
            continue;
          }

          const customerCost = Number(selectedOption.price);
          const sellerCost = Number(selectedOption.sellerCost);
          
          console.log(`✅ Chamada ${i}: Cliente R$ ${customerCost.toFixed(2)} | Vendedor R$ ${sellerCost.toFixed(2)}`);
          
          results.push({
            attempt: i,
            success: true,
            customerCost,
            sellerCost,
            method: selectedOption.method,
            rawData: selectedOption
          });

        } catch (error: any) {
          console.error(`❌ Erro na chamada ${i}:`, error);
          results.push({ attempt: i, success: false, error: error.message });
        }

        // Delay entre chamadas
        if (i < 3) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      return results;
    } catch (error: any) {
      console.error('💥 ERRO GERAL NAS MÚLTIPLAS CHAMADAS:', error);
      return [];
    }
  };

  const findConsensusValue = (results: any[]) => {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      throw new Error('Todas as chamadas falharam');
    }

    if (successfulResults.length === 1) {
      console.log('🎯 CONSENSO: Apenas 1 valor válido');
      return { ...successfulResults[0], reliability: 100 };
    }

    // Agrupar valores similares (considera diferenças de até R$ 0.50)
    const groups: any[] = [];
    
    successfulResults.forEach(result => {
      const existingGroup = groups.find(group => 
        Math.abs(group.sellerCost - result.sellerCost) <= 0.50 &&
        Math.abs(group.customerCost - result.customerCost) <= 0.50
      );
      
      if (existingGroup) {
        existingGroup.count++;
        existingGroup.results.push(result);
      } else {
        groups.push({
          sellerCost: result.sellerCost,
          customerCost: result.customerCost,
          method: result.method,
          count: 1,
          results: [result]
        });
      }
    });

    // Encontrar grupo com mais ocorrências
    const bestGroup = groups.reduce((prev, current) => 
      current.count > prev.count ? current : prev
    );

    const reliability = (bestGroup.count / successfulResults.length) * 100;
    
    console.log('🎯 ANÁLISE DE CONSENSO:');
    console.log(`- Chamadas sucessos: ${successfulResults.length}/3`);
    console.log(`- Grupos encontrados: ${groups.length}`);
    console.log(`- Melhor grupo: ${bestGroup.count} ocorrências`);
    console.log(`- Confiabilidade: ${reliability.toFixed(1)}%`);

    return {
      customerCost: bestGroup.customerCost,
      sellerCost: bestGroup.sellerCost,
      method: bestGroup.method,
      reliability,
      rawData: bestGroup.results[0].rawData
    };
  };

  const fetchFreightCosts = async (productId: string, forceRecalculate = false) => {
    const calculationCache = getFreightCache();
    const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
    
    // Check cache apenas se não for recalcular forçadamente
    if (!forceRecalculate) {
      const cachedCalculation = calculationCache[productId];
      if (cachedCalculation && cachedCalculation.timestamp > fortyEightHoursAgo) {
        const cacheAge = Date.now() - cachedCalculation.timestamp;
        
        console.log(`📋 Usando cálculo em cache para produto ${productId}`);
        
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
      // Fazer múltiplas chamadas
      const results = await makeMultipleFreightCalls(productId);
      
      // Encontrar consenso
      const consensusValue = findConsensusValue(results);
      
      const finalCustomerCost = consensusValue.customerCost;
      const finalSellerCost = consensusValue.sellerCost;
      const reliability = consensusValue.reliability;

      // Log debug information
      FreightDebugger.logFreightCalculation({
        productId,
        value: finalSellerCost,
        source: 'api',
        timestamp: Date.now(),
        calculationMethod: `${consensusValue.method} (Consenso)`,
        apiResponse: { consensusValue, allResults: results },
        rawData: consensusValue.rawData
      });

      onFreightCalculated(productId, {
        freightCost: finalCustomerCost,
        sellerFreightCost: finalSellerCost,
        freightMethod: `${consensusValue.method} (${reliability.toFixed(0)}% confiável)`
      });

      // Update cache
      calculationCache[productId] = {
        freightCost: finalCustomerCost,
        sellerFreightCost: finalSellerCost,
        freightMethod: `${consensusValue.method} (${reliability.toFixed(0)}% confiável)`,
        timestamp: Date.now(),
        zipCode: STANDARD_ZIP_CODE,
        reliability: reliability,
        consensusData: { results, consensusValue }
      };
      setFreightCache(calculationCache);

      const reliabilityText = reliability >= 100 ? 'Muito Alta' : 
                             reliability >= 67 ? 'Alta' : 
                             'Moderada';
      
      toast({
        title: "✅ Frete calculado com múltiplas chamadas!",
        description: `${consensusValue.method}: Cliente R$ ${finalCustomerCost.toFixed(2)} | Vendedor R$ ${finalSellerCost.toFixed(2)} (Confiabilidade: ${reliabilityText})`,
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
          Calculadora de Frete Real (Sistema de Consenso)
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
            Calcule o custo real do frete com sistema de múltiplas chamadas para maior precisão
            <br />
            <span className="text-sm opacity-75">
              CEP padrão: {STANDARD_ZIP_CODE} | 3 chamadas por cálculo | Valores salvos por 48h
            </span>
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
              Recalcular c/ Consenso
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
                Sistema de consenso: 3 chamadas por produto, seleção do valor mais frequente.
                Confiabilidade calculada baseada na consistência dos resultados.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
