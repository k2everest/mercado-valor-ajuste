
import { useState, useCallback, useMemo } from 'react';
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FreightDebugger } from '@/utils/freightDebug';
import { useFreightPersistence } from './useFreightPersistence';
import { cacheManager } from '@/utils/cacheManager';
import { SecureStorage } from '@/utils/secureStorage';

interface FreightCallResult {
  attempt: number;
  price: number;
  sellerCost: number;
  method: string;
  success: boolean;
  error?: string;
}

interface ConsensusResult extends FreightCallResult {
  consensus: {
    frequency: number;
    total: number;
    reliability: number;
  };
}

export const useFreightCalculation = () => {
  const [loadingFreight, setLoadingFreight] = useState<Record<string, boolean>>({});
  const { saveFreightHistory, getCurrentFreight } = useFreightPersistence();

  const makeFreightCall = useCallback(async (productId: string, zipCode: string, attempt: number): Promise<FreightCallResult> => {
    try {
      // Buscar tokens do SecureStorage ao invés de localStorage diretamente
      const tokens = await SecureStorage.getMLTokens();
      if (!tokens || await SecureStorage.isMLTokenExpired()) {
        throw new Error('Token de acesso não encontrado ou expirado. Reconecte-se ao Mercado Livre.');
      }

      const { data, error } = await supabase.functions.invoke('mercadolivre-freight', {
        body: { 
          action: 'getShippingCosts',
          productId,
          zipCode: zipCode.replace(/\D/g, ''),
          accessToken: tokens.accessToken
        }
      });

      if (error) {
        throw new Error(`Erro da API: ${error.message}`);
      }

      if (!data?.selectedOption) {
        throw new Error('API não retornou opção de frete válida');
      }

      const selectedOption = data.selectedOption;
      
      return {
        attempt,
        price: Number(selectedOption.price),
        sellerCost: Number(selectedOption.sellerCost),
        method: selectedOption.method,
        success: true
      };
    } catch (error: any) {
      return {
        attempt,
        price: 0,
        sellerCost: 0,
        method: 'Error',
        success: false,
        error: error.message
      };
    }
  }, []);

  const findConsensusValue = useCallback((results: FreightCallResult[]): ConsensusResult => {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      throw new Error('Todas as tentativas falharam');
    }

    if (successfulResults.length === 1) {
      console.log('🎯 CONSENSO: Apenas 1 valor válido encontrado');
      return {
        ...successfulResults[0],
        consensus: {
          frequency: 1,
          total: 1,
          reliability: 100
        }
      };
    }

    // Agrupar valores iguais
    const valueGroups: { [key: string]: FreightCallResult[] } = {};
    
    successfulResults.forEach(result => {
      const key = `${result.price}-${result.sellerCost}`;
      if (!valueGroups[key]) {
        valueGroups[key] = [];
      }
      valueGroups[key].push(result);
    });

    // Encontrar o grupo com mais ocorrências
    const groupEntries = Object.entries(valueGroups);
    const mostFrequentGroup = groupEntries.reduce((prev, current) => {
      return current[1].length > prev[1].length ? current : prev;
    });

    const selectedResult = mostFrequentGroup[1][0];
    const frequency = mostFrequentGroup[1].length;
    
    console.log('🎯 ANÁLISE DE CONSENSO:');
    console.log(`- Total de tentativas: ${results.length}`);
    console.log(`- Sucessos: ${successfulResults.length}`);
    console.log(`- Grupos de valores: ${groupEntries.length}`);
    console.log(`- Valor escolhido apareceu ${frequency}x de ${successfulResults.length}`);
    console.log(`- Confiabilidade: ${((frequency / successfulResults.length) * 100).toFixed(1)}%`);

    return {
      ...selectedResult,
      consensus: {
        frequency,
        total: successfulResults.length,
        reliability: (frequency / successfulResults.length) * 100
      }
    };
  }, []);

  const fetchFreightCosts = useCallback(async (productId: string, zipCode: string) => {
    if (!zipCode || zipCode.trim().length === 0) {
      toast({
        title: "❌ CEP obrigatório",
        description: "Digite um CEP válido para calcular o frete",
        variant: "destructive"
      });
      return null;
    }

    const cleanZipCode = zipCode.replace(/\D/g, '');
    if (cleanZipCode.length !== 8) {
      toast({
        title: "❌ CEP inválido",
        description: "Digite um CEP com 8 dígitos",
        variant: "destructive"
      });
      return null;
    }

    // Check cache first
    const cacheKey = `freight_${productId}_${cleanZipCode}`;
    const cachedResult = cacheManager.get<{freightCost: number; sellerFreightCost: number; freightMethod: string}>(cacheKey);
    if (cachedResult) {
      console.log('💾 Usando frete do cache:', cachedResult);
      toast({
        title: "💾 Frete do cache",
        description: `${cachedResult.freightMethod}: Cliente R$ ${cachedResult.freightCost} | Vendedor R$ ${cachedResult.sellerFreightCost}`,
      });
      return cachedResult;
    }

    // Verificar se já existe cálculo atual
    const existingFreight = await getCurrentFreight(productId, cleanZipCode);
    if (existingFreight) {
      console.log('📋 Usando frete do histórico:', existingFreight);
      const result = {
        freightCost: Number(existingFreight.freight_cost),
        sellerFreightCost: Number(existingFreight.seller_freight_cost),
        freightMethod: `${existingFreight.freight_method} (Histórico)`
      };
      
      // Cache the historical result
      cacheManager.set(cacheKey, result, 10 * 60 * 1000); // 10 minutes
      
      toast({
        title: "📋 Frete do histórico",
        description: `${existingFreight.freight_method}: Cliente R$ ${existingFreight.freight_cost} | Vendedor R$ ${existingFreight.seller_freight_cost}`,
      });

      return result;
    }

    setLoadingFreight(prev => ({ ...prev, [productId]: true }));

    try {
      console.log('🚚 INICIANDO CÁLCULO COM MÚLTIPLAS CHAMADAS');
      console.log('📦 Produto:', productId);
      console.log('📍 CEP:', cleanZipCode);
      
      const results: FreightCallResult[] = [];
      
      // Fazer 3 chamadas consecutivas
      for (let i = 1; i <= 3; i++) {
        console.log(`🔄 Tentativa ${i}/3...`);
        
        toast({
          title: `🔄 Calculando frete... (${i}/3)`,
          description: `Fazendo múltiplas chamadas para garantir precisão`,
        });

        const result = await makeFreightCall(productId, cleanZipCode, i);
        results.push(result);

        if (result.success) {
          console.log(`✅ Tentativa ${i}: Cliente R$ ${result.price.toFixed(2)} | Vendedor R$ ${result.sellerCost.toFixed(2)}`);
        } else {
          console.log(`❌ Tentativa ${i}: ${result.error}`);
        }

        if (i < 3) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // Analisar consenso e escolher melhor valor
      const consensusResult = findConsensusValue(results);
      
      const finalCustomerCost = consensusResult.price;
      const finalSellerCost = consensusResult.sellerCost;
      const reliability = consensusResult.consensus.reliability;

      // Salvar no histórico
      await saveFreightHistory(
        productId,
        cleanZipCode,
        finalCustomerCost,
        finalSellerCost,
        consensusResult.method
      );

      // Log debug information
      FreightDebugger.logFreightCalculation({
        productId,
        value: finalSellerCost,
        source: 'api',
        timestamp: Date.now(),
        calculationMethod: `${consensusResult.method} (Consenso)`,
        apiResponse: { consensusResult, allResults: results },
        rawData: consensusResult
      });

      const reliabilityText = reliability >= 100 ? 'Muito Alta' : 
                             reliability >= 67 ? 'Alta' : 
                             'Moderada';

      const result = {
        freightCost: finalCustomerCost,
        sellerFreightCost: finalSellerCost,
        freightMethod: `${consensusResult.method} (${reliability.toFixed(0)}% confiável)`
      };

      // Cache the result
      cacheManager.set(cacheKey, result, 10 * 60 * 1000); // 10 minutes

      toast({
        title: "✅ Frete calculado com consenso!",
        description: `${consensusResult.method}: Cliente R$ ${finalCustomerCost.toFixed(2)} | Vendedor R$ ${finalSellerCost.toFixed(2)} (Confiabilidade: ${reliabilityText})`,
      });

      return result;

    } catch (error: any) {
      console.error('💥 ERRO NO CÁLCULO COM CONSENSO:', error);
      
      toast({
        title: "❌ Erro ao calcular frete",
        description: error.message,
        variant: "destructive"
      });
      return null;
    } finally {
      setLoadingFreight(prev => ({ ...prev, [productId]: false }));
    }
  }, [makeFreightCall, findConsensusValue, saveFreightHistory, getCurrentFreight]);

  return {
    loadingFreight,
    setLoadingFreight,
    fetchFreightCosts
  };
};
