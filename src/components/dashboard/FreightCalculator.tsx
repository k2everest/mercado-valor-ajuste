
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Calculator, Truck, RefreshCw } from "lucide-react";
import { Product } from './types';

interface FreightCalculatorProps {
  products: Product[];
  onFreightCalculated: (productId: string, freightData: {
    freightCost: number;
    sellerFreightCost: number;
    freightMethod: string;
  }) => void;
  loadingFreight: Record<string, boolean>;
  setLoadingFreight: (loading: Record<string, boolean>) => void;
}

// Standard ZIP code for São Paulo center (sender location)
const STANDARD_ZIP_CODE = '01310-100';

export const FreightCalculator = ({ 
  products, 
  onFreightCalculated, 
  loadingFreight, 
  setLoadingFreight 
}: FreightCalculatorProps) => {
  const [lastCalculationCheck, setLastCalculationCheck] = useState<string>('');

  const getFreightCache = () => {
    return JSON.parse(localStorage.getItem('freight_calculations') || '{}');
  };

  const setFreightCache = (cache: any) => {
    localStorage.setItem('freight_calculations', JSON.stringify(cache));
  };

  const getLastNotificationCheck = () => {
    return localStorage.getItem('last_notification_check') || '';
  };

  const setLastNotificationCheck = (timestamp: string) => {
    localStorage.setItem('last_notification_check', timestamp);
  };

  const checkForFreightChanges = async () => {
    try {
      console.log('🔍 Verificando mudanças de frete desde última verificação...');
      
      const lastCheck = getLastNotificationCheck();
      const currentTime = new Date().toISOString();
      
      // Store current check time
      setLastNotificationCheck(currentTime);
      setLastCalculationCheck(currentTime);
      
      if (lastCheck) {
        const timeDiff = new Date(currentTime).getTime() - new Date(lastCheck).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        toast({
          title: "🔍 Verificação de mudanças",
          description: `Última verificação: ${hoursDiff.toFixed(1)} horas atrás`,
        });
      } else {
        toast({
          title: "🔍 Primeira verificação",
          description: "Iniciando monitoramento de mudanças de frete",
        });
      }
      
    } catch (error) {
      console.error('Erro ao verificar mudanças:', error);
    }
  };

  const fetchFreightCosts = async (productId: string, forceRecalculate = false) => {
    const calculationCache = getFreightCache();
    const twoDaysAgo = Date.now() - (48 * 60 * 60 * 1000); // 48 hours cache
    
    // Check if we have a recent calculation and don't need to force recalculate
    if (!forceRecalculate) {
      const cachedCalculation = calculationCache[productId];
      if (cachedCalculation && cachedCalculation.timestamp > twoDaysAgo) {
        console.log(`📋 Usando cálculo em cache para produto ${productId}`);
        onFreightCalculated(productId, {
          freightCost: cachedCalculation.freightCost,
          sellerFreightCost: cachedCalculation.sellerFreightCost,
          freightMethod: cachedCalculation.freightMethod
        });
        
        toast({
          title: "📋 Valor em cache",
          description: `Usando cálculo salvo (${Math.round((Date.now() - cachedCalculation.timestamp) / (1000 * 60 * 60))}h atrás)`,
        });
        return;
      }
    }

    setLoadingFreight(prev => ({ ...prev, [productId]: true }));

    try {
      console.log('🚚 CALCULANDO CUSTO REAL DE FRETE');
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

      console.log('📦 RESPOSTA DA API:', JSON.stringify(data, null, 2));
      
      const selectedOption = data?.selectedOption || data?.freightOptions?.[0];
      
      if (!selectedOption) {
        console.error('❌ NENHUMA OPÇÃO VÁLIDA DE FRETE RETORNADA');
        throw new Error('API do Mercado Livre não retornou opções de frete válidas');
      }

      const finalCustomerCost = Number(selectedOption.price);
      const finalSellerCost = Number(selectedOption.sellerCost);

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

      const discountInfo = selectedOption.discount ? ` (desconto: ${selectedOption.discount})` : '';
      
      toast({
        title: "✅ Custo calculado e salvo!",
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
    await checkForFreightChanges();
    
    for (const product of products) {
      if (!loadingFreight[product.id]) {
        await fetchFreightCosts(product.id, forceRecalculate);
        // Small delay to avoid API rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
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
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-blue-100">
            Calcule o custo real do frete que você paga como vendedor
            <br />
            <span className="text-sm opacity-75">CEP padrão: {STANDARD_ZIP_CODE} (valores salvos por 48h)</span>
          </p>
          
          {lastCalculationCheck && (
            <p className="text-blue-200 text-sm">
              Última verificação: {new Date(lastCalculationCheck).toLocaleString('pt-BR')}
            </p>
          )}
          
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
