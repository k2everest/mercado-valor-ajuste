
import { useState } from 'react';
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FreightDebugger } from '@/utils/freightDebug';

export const useFreightCalculation = () => {
  const [loadingFreight, setLoadingFreight] = useState<Record<string, boolean>>({});

  const fetchFreightCosts = async (productId: string, zipCode: string) => {
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

    setLoadingFreight(prev => ({ ...prev, [productId]: true }));

    try {
      console.log('🚚 CALCULANDO FRETE REAL - API OFICIAL ML');
      console.log('📦 Produto:', productId);
      console.log('📍 CEP:', cleanZipCode);
      
      const accessToken = localStorage.getItem('ml_access_token');
      if (!accessToken) {
        throw new Error('Token de acesso não encontrado. Reconecte-se ao Mercado Livre.');
      }

      console.log('🔄 Chamando função de frete com debug...');

      const { data, error } = await supabase.functions.invoke('mercadolivre-freight', {
        body: { 
          action: 'getShippingCosts',
          productId,
          zipCode: cleanZipCode,
          accessToken
        }
      });

      if (error) {
        console.error('❌ Erro na função:', error);
        throw new Error(`Erro da API: ${error.message}`);
      }

      console.log('📦 Resposta completa da API com debug:', JSON.stringify(data, null, 2));
      
      if (!data?.selectedOption) {
        console.error('❌ Nenhuma opção selecionada na resposta');
        throw new Error('API não retornou opção de frete válida');
      }

      const selectedOption = data.selectedOption;
      
      // Validar dados da resposta
      if (typeof selectedOption.price !== 'number' || 
          typeof selectedOption.sellerCost !== 'number') {
        console.error('❌ Dados inválidos na resposta:', selectedOption);
        throw new Error('API retornou dados de frete inválidos');
      }

      const finalCustomerCost = selectedOption.price;
      const finalSellerCost = selectedOption.sellerCost;

      console.log('✅ RESULTADO FINAL DA API OFICIAL:');
      console.log('- Preço Cliente:', finalCustomerCost);
      console.log('- Custo Vendedor:', finalSellerCost);
      console.log('- Método:', selectedOption.method);
      console.log('- Pago por:', selectedOption.paidBy);
      console.log('- Dados brutos da API:', selectedOption.rawData);

      // Log debug information
      FreightDebugger.logFreightCalculation({
        productId,
        value: finalSellerCost,
        source: 'api',
        timestamp: Date.now(),
        calculationMethod: selectedOption.method,
        apiResponse: data,
        rawData: selectedOption
      });

      toast({
        title: "✅ Frete calculado com API oficial!",
        description: `${selectedOption.method}: Cliente R$ ${finalCustomerCost.toFixed(2)} | Vendedor R$ ${finalSellerCost.toFixed(2)}`,
      });

      return {
        freightCost: finalCustomerCost,
        sellerFreightCost: finalSellerCost,
        freightMethod: selectedOption.method
      };

    } catch (error: any) {
      console.error('💥 ERRO NO CÁLCULO:', error);
      
      toast({
        title: "❌ Erro ao calcular frete",
        description: error.message,
        variant: "destructive"
      });
      return null;
    } finally {
      setLoadingFreight(prev => ({ ...prev, [productId]: false }));
    }
  };

  return {
    loadingFreight,
    setLoadingFreight,
    fetchFreightCosts
  };
};
